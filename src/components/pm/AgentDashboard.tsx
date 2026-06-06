/**
 * PM Agent Dashboard
 * Real-time monitoring panel for all 14 agents
 */
import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Badge, Progress, Tag, Statistic, Alert } from 'antd';
import {
  TeamOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';

export interface AgentStatus {
  id: string;
  role: string;
  code: string;
  status: 'online' | 'offline' | 'busy' | 'idle' | 'error';
  currentTask: string;
  progress: number;
  lastHeartbeat: string;
  testsPassed: number;
  testsFailed: number;
  linesAdded: number;
}

const DEFAULT_AGENTS: AgentStatus[] = [
  { id: 'agent-market', role: 'MARKET', code: '📊', status: 'idle', currentTask: 'Waiting for R34', progress: 0, lastHeartbeat: new Date().toISOString(), testsPassed: 0, testsFailed: 0, linesAdded: 0 },
  { id: 'agent-account', role: 'ACCOUNT', code: '💰', status: 'idle', currentTask: 'Waiting for R34', progress: 0, lastHeartbeat: new Date().toISOString(), testsPassed: 0, testsFailed: 0, linesAdded: 0 },
  { id: 'agent-history', role: 'HISTORY', code: '📚', status: 'idle', currentTask: 'Waiting for R34', progress: 0, lastHeartbeat: new Date().toISOString(), testsPassed: 0, testsFailed: 0, linesAdded: 0 },
  { id: 'agent-futu', role: 'FUTU', code: '🇭🇰', status: 'idle', currentTask: 'Waiting for R34', progress: 0, lastHeartbeat: new Date().toISOString(), testsPassed: 0, testsFailed: 0, linesAdded: 0 },
  { id: 'agent-intl', role: 'INTL', code: '🌍', status: 'idle', currentTask: 'Waiting for R34', progress: 0, lastHeartbeat: new Date().toISOString(), testsPassed: 0, testsFailed: 0, linesAdded: 0 },
  { id: 'agent-strategy', role: 'STRATEGY', code: '🧠', status: 'idle', currentTask: 'Waiting for R34', progress: 0, lastHeartbeat: new Date().toISOString(), testsPassed: 0, testsFailed: 0, linesAdded: 0 },
  { id: 'agent-risk', role: 'RISK', code: '🛡️', status: 'idle', currentTask: 'Waiting for R34', progress: 0, lastHeartbeat: new Date().toISOString(), testsPassed: 0, testsFailed: 0, linesAdded: 0 },
  { id: 'agent-exec', role: 'EXEC', code: '⚡', status: 'idle', currentTask: 'Waiting for R34', progress: 0, lastHeartbeat: new Date().toISOString(), testsPassed: 0, testsFailed: 0, linesAdded: 0 },
  { id: 'agent-auto', role: 'AUTO', code: '🤖', status: 'idle', currentTask: 'Waiting for R34', progress: 0, lastHeartbeat: new Date().toISOString(), testsPassed: 0, testsFailed: 0, linesAdded: 0 },
  { id: 'agent-ui-trade', role: 'UI-TRADE', code: '🖥️', status: 'idle', currentTask: 'Waiting for R34', progress: 0, lastHeartbeat: new Date().toISOString(), testsPassed: 0, testsFailed: 0, linesAdded: 0 },
  { id: 'agent-ui-mon', role: 'UI-MON', code: '📈', status: 'idle', currentTask: 'Waiting for R34', progress: 0, lastHeartbeat: new Date().toISOString(), testsPassed: 0, testsFailed: 0, linesAdded: 0 },
  { id: 'agent-ui-config', role: 'UI-CONFIG', code: '⚙️', status: 'idle', currentTask: 'Waiting for R34', progress: 0, lastHeartbeat: new Date().toISOString(), testsPassed: 0, testsFailed: 0, linesAdded: 0 },
  { id: 'agent-qa', role: 'QA', code: '🧪', status: 'idle', currentTask: 'Waiting for R34', progress: 0, lastHeartbeat: new Date().toISOString(), testsPassed: 0, testsFailed: 0, linesAdded: 0 },
  { id: 'agent-devops', role: 'DEVOPS', code: '🚀', status: 'idle', currentTask: 'Waiting for R34', progress: 0, lastHeartbeat: new Date().toISOString(), testsPassed: 0, testsFailed: 0, linesAdded: 0 },
];

const StatusIcon = ({ status }: { status: AgentStatus['status'] }) => {
  switch (status) {
    case 'online': return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    case 'offline': return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
    case 'busy': return <SyncOutlined spin style={{ color: '#1890ff' }} />;
    case 'idle': return <ClockCircleOutlined style={{ color: '#faad14' }} />;
    case 'error': return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
    default: return null;
  }
};

const StatusBadge = ({ status }: { status: AgentStatus['status'] }) => {
  const colors: Record<string, string> = {
    online: 'success',
    offline: 'error',
    busy: 'processing',
    idle: 'warning',
    error: 'error',
  };
  return <Badge status={colors[status] as any} text={status.toUpperCase()} />;
};

export const AgentDashboard: React.FC = () => {
  const [agents] = useState<AgentStatus[]>(DEFAULT_AGENTS);
  const [totalTests] = useState(1311);
  const [failedTests] = useState(0);
  const [lastUpdate, setLastUpdate] = useState(new Date().toLocaleTimeString());

  // Simulate heartbeat updates
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(new Date().toLocaleTimeString());
      // In real implementation, read from chat-bridge
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const onlineCount = agents.filter(a => a.status === 'online' || a.status === 'busy' || a.status === 'idle').length;
  const busyCount = agents.filter(a => a.status === 'busy').length;
  const totalLines = agents.reduce((sum, a) => sum + a.linesAdded, 0);

  return (
    <div style={{ padding: 24 }}>
      <h1><TeamOutlined /> 14 虾实时监控面板</h1>
      <p>Last update: {lastUpdate}</p>

      {/* Summary Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={4}>
          <Card>
            <Statistic title="在线虾" value={onlineCount} suffix={`/ ${agents.length}`} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="工作中" value={busyCount} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="测试通过" value={totalTests} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="测试失败" value={failedTests} valueStyle={{ color: failedTests > 0 ? '#ff4d4f' : '#52c41a' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="代码产出" value={totalLines} suffix="L" />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="版本" value="0.7.0" />
          </Card>
        </Col>
      </Row>

      {/* Agent Grid */}
      <Row gutter={[16, 16]}>
        {agents.map(agent => (
          <Col span={6} key={agent.id}>
            <Card
              size="small"
              title={
                <span>
                  {agent.code} {agent.role}
                  <span style={{ float: 'right' }}>
                    <StatusIcon status={agent.status} />
                  </span>
                </span>
              }
            >
              <div style={{ marginBottom: 8 }}>
                <StatusBadge status={agent.status} />
              </div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                Task: {agent.currentTask}
              </div>
              <Progress percent={agent.progress} size="small" />
              <div style={{ marginTop: 8, fontSize: 11 }}>
                <Tag color="green">✓ {agent.testsPassed}</Tag>
                <Tag color={agent.testsFailed > 0 ? 'red' : 'default'}>✗ {agent.testsFailed}</Tag>
                <Tag>+{agent.linesAdded}L</Tag>
              </div>
              <div style={{ fontSize: 10, color: '#999', marginTop: 4 }}>
                Heartbeat: {new Date(agent.lastHeartbeat).toLocaleTimeString()}
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Alerts */}
      {failedTests > 0 && (
        <Alert
          message={`${failedTests} tests failing`}
          description="Some agents have failing tests. Check individual agent status."
          type="error"
          showIcon
          style={{ marginTop: 24 }}
        />
      )}
    </div>
  );
};
