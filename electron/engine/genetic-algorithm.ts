import log from 'electron-log';

// =============================================================================
// JVS-91: Genetic Algorithm Optimizer
// Strategy parameter optimization using evolutionary computation
// =============================================================================

// ---------------------------------------------------------------------------
// Core Interfaces
// ---------------------------------------------------------------------------

export interface Gene {
  name: string;
  min: number;
  max: number;
  step: number;          // discretization step
  type: 'int' | 'float';
}

export interface Individual {
  genes: Record<string, number>;
  fitness: number;
  generation: number;
}

export interface GAConfig {
  populationSize: number;
  generations: number;
  crossoverRate: number;    // 0-1
  mutationRate: number;     // 0-1
  elitismCount: number;     // top N preserved
  tournamentSize: number;
  fitnessFunction: (genes: Record<string, number>) => number;
  genes: Gene[];
  maximize: boolean;        // true = higher fitness is better
}

export interface GAResult {
  bestIndividual: Individual;
  bestFitness: number;
  bestGenes: Record<string, number>;
  generations: number;
  fitnessHistory: { generation: number; bestFitness: number; avgFitness: number }[];
  paretoFront?: Individual[];
  durationMs: number;
  totalEvaluations: number;
}

// ---------------------------------------------------------------------------
// Fitness history entry
// ---------------------------------------------------------------------------

interface FitnessHistoryEntry {
  generation: number;
  bestFitness: number;
  avgFitness: number;
}

// ---------------------------------------------------------------------------
// Utility: Box-Muller transform for gaussian random numbers
// ---------------------------------------------------------------------------

function gaussianRandom(mean: number = 0, stddev: number = 1): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * stddev + mean;
}

// ---------------------------------------------------------------------------
// Utility: clamp a value within [min, max]
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ---------------------------------------------------------------------------
// Utility: round to the nearest step
// ---------------------------------------------------------------------------

function roundToStep(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

// ---------------------------------------------------------------------------
// Utility: deep clone an individual
// ---------------------------------------------------------------------------

function cloneIndividual(individual: Individual): Individual {
  return {
    genes: { ...individual.genes },
    fitness: individual.fitness,
    generation: individual.generation,
  };
}

// ---------------------------------------------------------------------------
// Default GA configuration values
// ---------------------------------------------------------------------------

const DEFAULT_POPULATION_SIZE = 100;
const DEFAULT_GENERATIONS = 200;
const DEFAULT_CROSSOVER_RATE = 0.8;
const DEFAULT_MUTATION_RATE = 0.1;
const DEFAULT_ELITISM_COUNT = 2;
const DEFAULT_TOURNAMENT_SIZE = 5;
const MUTATION_SIGMA_FACTOR = 0.1;   // sigma = (max - min) * factor
const FITNESS_EQUALITY_EPSILON = 1e-9;

// ---------------------------------------------------------------------------
// GeneticAlgorithm class
// ---------------------------------------------------------------------------

export class GeneticAlgorithm {
  // ---- Configuration ----
  private config: GAConfig | null = null;
  private population: Individual[] = [];
  private currentGeneration: number = 0;
  private fitnessHistory: FitnessHistoryEntry[] = [];
  private totalEvaluations: number = 0;
  private bestIndividual: Individual | null = null;
  private initialized: boolean = false;

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Run the full optimization loop from start to finish.
   * Returns the best result found across all generations.
   */
  optimize(config: GAConfig): GAResult {
    const startTime = performance.now();

    log.info(
      `[GA] Starting optimization: pop=${config.populationSize}, ` +
      `gen=${config.generations}, genes=${config.genes.length}, ` +
      `maximize=${config.maximize}`
    );

    this.validateConfig(config);
    this.config = config;
    this.reset();

    // Initialize the first generation
    this.initializePopulation();
    this.evaluateFitness();
    this.recordFitnessHistory();
    this.updateBestIndividual();

    log.info(
      `[GA] Generation 0 complete. Best fitness=${this.bestIndividual!.fitness.toFixed(6)}`
    );

    // Main evolutionary loop
    for (let gen = 1; gen <= config.generations; gen++) {
      this.step();

      if (gen % 50 === 0 || gen === config.generations) {
        log.info(
          `[GA] Generation ${gen}/${config.generations}. ` +
          `Best fitness=${this.bestIndividual!.fitness.toFixed(6)}, ` +
          `Avg fitness=${this.getAverageFitness().toFixed(6)}`
        );
      }
    }

    const durationMs = performance.now() - startTime;

    // Build result
    const result = this.buildResult(durationMs);

    log.info(
      `[GA] Optimization complete. Best fitness=${result.bestFitness.toFixed(6)}, ` +
      `duration=${result.durationMs.toFixed(0)}ms, ` +
      `evaluations=${result.totalEvaluations}`
    );

    return result;
  }

  /**
   * Advance one generation. Useful for incremental / interactive use.
   * Must be called after an initial optimize() or manual setup.
   */
  step(): void {
    if (!this.config) {
      throw new Error('[GA] No configuration set. Call optimize() first.');
    }
    if (!this.initialized) {
      throw new Error('[GA] Not initialized. Call optimize() first.');
    }

    const config = this.config;
    const nextGeneration: Individual[] = [];
    this.currentGeneration++;

    // 1. Elitism: carry over the top N individuals unchanged
    const sorted = this.getSortedPopulation();
    for (let i = 0; i < config.elitismCount && i < sorted.length; i++) {
      const elite = cloneIndividual(sorted[i]);
      elite.generation = this.currentGeneration;
      nextGeneration.push(elite);
    }

    // 2. Fill the rest of the new population via selection + crossover + mutation
    while (nextGeneration.length < config.populationSize) {
      const parent1 = this.tournamentSelect();
      const parent2 = this.tournamentSelect();

      let child: Individual;

      if (Math.random() < config.crossoverRate) {
        child = this.crossover(parent1, parent2);
      } else {
        // Clone the better parent
        child = cloneIndividual(
          this.isBetter(parent1, parent2) ? parent1 : parent2
        );
      }

      child.generation = this.currentGeneration;
      child = this.mutate(child);
      nextGeneration.push(child);
    }

    // 3. Replace population
    this.population = nextGeneration;

    // 4. Evaluate fitness
    this.evaluateFitness();

    // 5. Record history
    this.recordFitnessHistory();

    // 6. Update global best
    this.updateBestIndividual();
  }

  /**
   * Get a copy of the current population.
   */
  getPopulation(): Individual[] {
    return this.population.map(cloneIndividual);
  }

  /**
   * Get the best individual found so far (across all generations).
   */
  getBestIndividual(): Individual {
    if (!this.bestIndividual) {
      throw new Error('[GA] No best individual. Run at least one generation.');
    }
    return cloneIndividual(this.bestIndividual);
  }

  /**
   * Reset the algorithm state for a new run.
   */
  reset(): void {
    this.population = [];
    this.currentGeneration = 0;
    this.fitnessHistory = [];
    this.totalEvaluations = 0;
    this.bestIndividual = null;
    this.initialized = false;
    log.debug('[GA] State reset.');
  }

  /**
   * Get the fitness history array.
   */
  getFitnessHistory(): FitnessHistoryEntry[] {
    return [...this.fitnessHistory];
  }

  /**
   * Get the current generation number.
   */
  getCurrentGeneration(): number {
    return this.currentGeneration;
  }

  /**
   * Get total fitness evaluations performed so far.
   */
  getTotalEvaluations(): number {
    return this.totalEvaluations;
  }

  // ===========================================================================
  // Internal: Population initialization
  // ===========================================================================

  /**
   * Create the initial population with random gene values within bounds.
   * Uses Latin Hypercube Sampling-like stratification for better coverage.
   */
  private initializePopulation(): void {
    if (!this.config) {
      throw new Error('[GA] No configuration set.');
    }

    const { populationSize, genes } = this.config;
    this.population = [];

    log.debug(`[GA] Initializing population of size ${populationSize} with ${genes.length} genes.`);

    for (let i = 0; i < populationSize; i++) {
      const individual = this.createRandomIndividual(0);
      this.population.push(individual);
    }

    this.initialized = true;
    log.debug('[GA] Population initialized.');
  }

  /**
   * Create a single random individual.
   */
  private createRandomIndividual(generation: number): Individual {
    if (!this.config) {
      throw new Error('[GA] No configuration set.');
    }

    const genes: Record<string, number> = {};

    for (const geneDef of this.config.genes) {
      genes[geneDef.name] = this.randomGeneValue(geneDef);
    }

    return {
      genes,
      fitness: 0,
      generation,
    };
  }

  /**
   * Generate a random value for a gene within its bounds, respecting step.
   */
  private randomGeneValue(geneDef: Gene): number {
    const range = geneDef.max - geneDef.min;
    const rawValue = geneDef.min + Math.random() * range;
    let value = roundToStep(rawValue, geneDef.step);

    // Clamp to bounds after rounding
    value = clamp(value, geneDef.min, geneDef.max);

    // Enforce integer type
    if (geneDef.type === 'int') {
      value = Math.round(value);
    }

    return value;
  }

  // ===========================================================================
  // Internal: Selection
  // ===========================================================================

  /**
   * Tournament selection: pick `tournamentSize` random individuals and
   * return the best among them.
   */
  private tournamentSelect(): Individual {
    if (!this.config) {
      throw new Error('[GA] No configuration set.');
    }

    const { tournamentSize, populationSize } = this.config;
    let bestCandidate: Individual | null = null;

    for (let i = 0; i < tournamentSize; i++) {
      const idx = Math.floor(Math.random() * populationSize);
      const candidate = this.population[idx];

      if (bestCandidate === null || this.isBetter(candidate, bestCandidate)) {
        bestCandidate = candidate;
      }
    }

    return cloneIndividual(bestCandidate!);
  }

  // ===========================================================================
  // Internal: Crossover
  // ===========================================================================

  /**
   * Single-point crossover between two parents.
   * Genes are treated as an ordered list; a random split point is chosen.
   */
  private crossover(parent1: Individual, parent2: Individual): Individual {
    if (!this.config) {
      throw new Error('[GA] No configuration set.');
    }

    const geneNames = this.config.genes.map((g) => g.name);
    const numGenes = geneNames.length;

    if (numGenes <= 1) {
      // With only one gene, crossover is meaningless — just clone parent1
      return cloneIndividual(parent1);
    }

    // Choose crossover point: 1 to numGenes - 1
    const crossoverPoint = 1 + Math.floor(Math.random() * (numGenes - 1));

    const childGenes: Record<string, number> = {};

    for (let i = 0; i < numGenes; i++) {
      const geneName = geneNames[i];
      if (i < crossoverPoint) {
        childGenes[geneName] = parent1.genes[geneName];
      } else {
        childGenes[geneName] = parent2.genes[geneName];
      }
    }

    return {
      genes: childGenes,
      fitness: 0,
      generation: this.currentGeneration,
    };
  }

  // ===========================================================================
  // Internal: Mutation
  // ===========================================================================

  /**
   * Gaussian mutation: each gene has a chance of being perturbed by
   * a gaussian-distributed value. The sigma is proportional to the
   * gene's range.
   */
  private mutate(individual: Individual): Individual {
    if (!this.config) {
      throw new Error('[GA] No configuration set.');
    }

    const { mutationRate, genes: geneDefs } = this.config;
    const mutated = cloneIndividual(individual);

    for (const geneDef of geneDefs) {
      if (Math.random() < mutationRate) {
        const range = geneDef.max - geneDef.min;
        const sigma = range * MUTATION_SIGMA_FACTOR;
        const currentValue = mutated.genes[geneDef.name];
        let newValue = currentValue + gaussianRandom(0, sigma);

        // Round to step
        newValue = roundToStep(newValue, geneDef.step);

        // Clamp to bounds
        newValue = clamp(newValue, geneDef.min, geneDef.max);

        // Enforce integer
        if (geneDef.type === 'int') {
          newValue = Math.round(newValue);
        }

        mutated.genes[geneDef.name] = newValue;
      }
    }

    return mutated;
  }

  // ===========================================================================
  // Internal: Fitness evaluation
  // ===========================================================================

  /**
   * Evaluate the fitness function for every individual in the population.
   * Handles errors gracefully — individuals that throw get the worst
   * possible fitness.
   */
  private evaluateFitness(): void {
    if (!this.config) {
      throw new Error('[GA] No configuration set.');
    }

    const { fitnessFunction, maximize } = this.config;
    const worstFitness = maximize ? -Infinity : Infinity;

    for (const individual of this.population) {
      try {
        individual.fitness = fitnessFunction(individual.genes);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        log.warn(
          `[GA] Fitness evaluation failed for individual (gen=${individual.generation}): ${errorMsg}`
        );
        individual.fitness = worstFitness;
      }
      this.totalEvaluations++;
    }
  }

  // ===========================================================================
  // Internal: Bookkeeping
  // ===========================================================================

  /**
   * Record the best and average fitness for the current generation.
   */
  private recordFitnessHistory(): void {
    const bestFitness = this.getBestFitnessInPopulation();
    const avgFitness = this.getAverageFitness();

    this.fitnessHistory.push({
      generation: this.currentGeneration,
      bestFitness,
      avgFitness,
    });
  }

  /**
   * Update the global best individual if the current population contains
   * a better one.
   */
  private updateBestIndividual(): void {
    const currentBest = this.getBestInPopulation();

    if (this.bestIndividual === null || this.isBetter(currentBest, this.bestIndividual)) {
      this.bestIndividual = cloneIndividual(currentBest);
      log.debug(
        `[GA] New best individual at gen=${this.currentGeneration}, ` +
        `fitness=${this.bestIndividual.fitness.toFixed(6)}`
      );
    }
  }

  /**
   * Determine if individual A is better than individual B based on
   * the optimization direction (maximize or minimize).
   */
  private isBetter(a: Individual, b: Individual): boolean {
    if (!this.config) {
      throw new Error('[GA] No configuration set.');
    }
    return this.config.maximize
      ? a.fitness > b.fitness
      : a.fitness < b.fitness;
  }

  /**
   * Get the best individual in the current population.
   */
  private getBestInPopulation(): Individual {
    if (this.population.length === 0) {
      throw new Error('[GA] Population is empty.');
    }

    let best = this.population[0];
    for (let i = 1; i < this.population.length; i++) {
      if (this.isBetter(this.population[i], best)) {
        best = this.population[i];
      }
    }
    return best;
  }

  /**
   * Get the best fitness value in the current population.
   */
  private getBestFitnessInPopulation(): number {
    const best = this.getBestInPopulation();
    return best.fitness;
  }

  /**
   * Calculate the average fitness of the current population.
   */
  private getAverageFitness(): number {
    if (this.population.length === 0) return 0;

    const sum = this.population.reduce((acc, ind) => acc + ind.fitness, 0);
    return sum / this.population.length;
  }

  /**
   * Return the population sorted by fitness (best first).
   */
  private getSortedPopulation(): Individual[] {
    const sorted = [...this.population];
    if (this.config?.maximize) {
      sorted.sort((a, b) => b.fitness - a.fitness);
    } else {
      sorted.sort((a, b) => a.fitness - b.fitness);
    }
    return sorted;
  }

  /**
   * Compute the standard deviation of fitness in the current population.
   */
  private getFitnessStddev(): number {
    if (this.population.length === 0) return 0;

    const avg = this.getAverageFitness();
    const variance =
      this.population.reduce((acc, ind) => {
        const diff = ind.fitness - avg;
        return acc + diff * diff;
      }, 0) / this.population.length;

    return Math.sqrt(variance);
  }

  /**
   * Compute diversity metric: average absolute difference between
   * all gene values across the population, normalized by range.
   */
  private getPopulationDiversity(): number {
    if (!this.config || this.population.length <= 1) return 0;

    const { genes: geneDefs } = this.config;
    let totalDiversity = 0;

    for (const geneDef of geneDefs) {
      const range = geneDef.max - geneDef.min;
      if (range === 0) continue;

      const values = this.population.map((ind) => ind.genes[geneDef.name]);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const avgAbsDev =
        values.reduce((acc, v) => acc + Math.abs(v - mean), 0) / values.length;

      totalDiversity += avgAbsDev / range;
    }

    return totalDiversity / geneDefs.length;
  }

  // ===========================================================================
  // Internal: Pareto front computation (for multi-objective extensions)
  // ===========================================================================

  /**
   * Compute the Pareto front from the current population.
   * For single-objective, this is simply the set of individuals
   * that share the best fitness value.
   */
  private computeParetoFront(): Individual[] {
    if (this.population.length === 0) return [];

    // For single-objective: all individuals with the optimal fitness
    const bestFitness = this.getBestFitnessInPopulation();
    const front = this.population.filter(
      (ind) => Math.abs(ind.fitness - bestFitness) < FITNESS_EQUALITY_EPSILON
    );

    return front.map(cloneIndividual);
  }

  // ===========================================================================
  // Internal: Result building
  // ===========================================================================

  /**
   * Build the final GAResult object.
   */
  private buildResult(durationMs: number): GAResult {
    if (!this.bestIndividual) {
      throw new Error('[GA] No best individual found after optimization.');
    }

    const paretoFront = this.computeParetoFront();

    return {
      bestIndividual: cloneIndividual(this.bestIndividual),
      bestFitness: this.bestIndividual.fitness,
      bestGenes: { ...this.bestIndividual.genes },
      generations: this.currentGeneration,
      fitnessHistory: [...this.fitnessHistory],
      paretoFront,
      durationMs,
      totalEvaluations: this.totalEvaluations,
    };
  }

  // ===========================================================================
  // Internal: Configuration validation
  // ===========================================================================

  /**
   * Validate the GA configuration before running.
   */
  private validateConfig(config: GAConfig): void {
    if (config.populationSize < 2) {
      throw new Error('[GA] Population size must be at least 2.');
    }
    if (config.generations < 1) {
      throw new Error('[GA] Generations must be at least 1.');
    }
    if (config.crossoverRate < 0 || config.crossoverRate > 1) {
      throw new Error('[GA] Crossover rate must be between 0 and 1.');
    }
    if (config.mutationRate < 0 || config.mutationRate > 1) {
      throw new Error('[GA] Mutation rate must be between 0 and 1.');
    }
    if (config.elitismCount < 0) {
      throw new Error('[GA] Elitism count must be non-negative.');
    }
    if (config.elitismCount >= config.populationSize) {
      throw new Error('[GA] Elitism count must be less than population size.');
    }
    if (config.tournamentSize < 1) {
      throw new Error('[GA] Tournament size must be at least 1.');
    }
    if (config.tournamentSize > config.populationSize) {
      throw new Error('[GA] Tournament size must not exceed population size.');
    }
    if (!config.genes || config.genes.length === 0) {
      throw new Error('[GA] At least one gene definition is required.');
    }
    if (typeof config.fitnessFunction !== 'function') {
      throw new Error('[GA] fitnessFunction must be a function.');
    }

    // Validate each gene definition
    for (const gene of config.genes) {
      this.validateGene(gene);
    }
  }

  /**
   * Validate a single gene definition.
   */
  private validateGene(gene: Gene): void {
    if (!gene.name || gene.name.trim() === '') {
      throw new Error('[GA] Gene name must be a non-empty string.');
    }
    if (gene.min >= gene.max) {
      throw new Error(`[GA] Gene "${gene.name}": min must be less than max.`);
    }
    if (gene.step <= 0) {
      throw new Error(`[GA] Gene "${gene.name}": step must be positive.`);
    }
    if (gene.type !== 'int' && gene.type !== 'float') {
      throw new Error(`[GA] Gene "${gene.name}": type must be 'int' or 'float'.`);
    }
    if (gene.step > gene.max - gene.min) {
      throw new Error(
        `[GA] Gene "${gene.name}": step must not exceed the range (max - min).`
      );
    }
  }

  // ===========================================================================
  // Public: Convenience static methods
  // ===========================================================================

  /**
   * Quick-run a one-shot optimization without managing the instance.
   */
  static run(config: GAConfig): GAResult {
    const ga = new GeneticAlgorithm();
    return ga.optimize(config);
  }

  /**
   * Create a pre-configured instance for incremental stepping.
   */
  static create(config: GAConfig): GeneticAlgorithm {
    const ga = new GeneticAlgorithm();
    ga.validateConfig(config);
    ga.config = config;
    ga.reset();
    ga.initializePopulation();
    ga.evaluateFitness();
    ga.recordFitnessHistory();
    ga.updateBestIndividual();
    return ga;
  }

  // ===========================================================================
  // Public: Diagnostics
  // ===========================================================================

  /**
   * Get a diagnostic summary of the current state.
   */
  getDiagnostics(): Record<string, unknown> {
    return {
      currentGeneration: this.currentGeneration,
      populationSize: this.population.length,
      totalEvaluations: this.totalEvaluations,
      bestFitness: this.bestIndividual?.fitness ?? null,
      averageFitness: this.getAverageFitness(),
      fitnessStddev: this.getFitnessStddev(),
      diversity: this.getPopulationDiversity(),
      initialized: this.initialized,
    };
  }

  /**
   * Log diagnostic information at debug level.
   */
  logDiagnostics(): void {
    const diag = this.getDiagnostics();
    log.debug(`[GA] Diagnostics: ${JSON.stringify(diag, null, 2)}`);
  }

  /**
   * Get a summary string suitable for logging.
   */
  getSummary(): string {
    if (!this.bestIndividual) {
      return '[GA] No optimization has been run yet.';
    }

    return (
      `[GA] Gen=${this.currentGeneration}, ` +
      `Best=${this.bestIndividual.fitness.toFixed(6)}, ` +
      `Avg=${this.getAverageFitness().toFixed(6)}, ` +
      `StdDev=${this.getFitnessStddev().toFixed(6)}, ` +
      `Diversity=${this.getPopulationDiversity().toFixed(4)}, ` +
      `Evals=${this.totalEvaluations}`
    );
  }
}
