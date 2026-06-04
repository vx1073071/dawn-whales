import { createExpect } from './expect.ts';

const e = createExpect(2);
// Check what keys are in e, and what notMatchers contains
console.log('e.keys:', Object.keys(e).filter(k => !['resolves','rejects'].includes(k)));

// Access .not without calling any matcher
const neg = e.not;
console.log('neg.keys:', Object.keys(neg).filter(k => !['resolves','rejects'].includes(k)));
console.log('neg.toBe === e.toBe:', neg.toBe === e.toBe);
console.log('neg.hasOwnProperty(not):', Object.hasOwnProperty.call(neg, 'not'));

// Now check: when we call e.toBe(2), what happens?
console.log('\nCalling e.toBe(2) (should PASS):');
try {
  e.toBe(2);
  console.log('PASSED');
} catch(err) {
  console.log('FAILED:', err.message);
}

// Check what getOwnPropertyNames gives us
console.log('\ngetOwnPropertyNames(neg):', Object.getOwnPropertyNames(neg));
console.log('getOwnPropertyNames(e):', Object.getOwnPropertyNames(e));

// Check if there's a 'not' getter on e
const eDesc = Object.getOwnPropertyDescriptor(e, 'not');
console.log('\ne.not descriptor:', eDesc);
console.log('e.not getter?', eDesc?.get);
