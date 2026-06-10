import re

pairs = [
    ("'连接失败'", "t('settings.connectionFailed')"),
    ("'连接异常'", "t('settings.connectionError')"),
    ("'确定删除该券商配置？'", "t('settings.confirmDeleteBroker')"),
    ("'券商管理'", "t('settings.brokerManagement')"),
    ("'快速连接'", "t('settings.quickConnect')"),
    ("'全局风控'", "t('settings.globalRisk')"),
    ("'系统信息'", "t('settings.systemInfo')"),
    ('>系统设置<', '>{t("settings.title")}<'),
    ('券商连接、风控参数、系统信息', '{t("settings.subtitle")}'),
    ('券商配置列表', '{t("settings.brokerConfig")}'),
    ('富途 Futu', '{t("settings.brokerFutu")}'),
    ('>主机<', '>{t("settings.host")}<'),
    ('>端口<', '>{t("settings.port")}<'),
    ("'添加中...'", "t('settings.adding')"),
    ("'确认添加'", "t('settings.confirmAdd')"),
    ('暂无券商配置，点击右上角添加', '{t("settings.noBroker")}'),
    ('当前使用', '{t("settings.currentlyInUse")}'),
    ('长桥 Longbridge (即将)', '{t("settings.longbridgeSoon")}'),
    ('盈透 IB (即将)', '{t("settings.ibSoon")}'),
    ('实盘 REAL', '{t("settings.realTrading")}'),
    ('模拟盘 SIMULATE', '{t("settings.simulateTrading")}'),
    ('OpenD 地址', '{t("settings.opendAddress")}'),
    ("'连接中...'", "t('settings.connecting')"),
    ("'断开连接'", "t('settings.disconnect')"),
    ("'连接 OpenD'", "t('settings.connectOpend')"),
    ('已连接 · Push 模式', '{t("settings.pushMode")}'),
    ('连接 OpenD 后可配置风控参数', '{t("settings.connectHint")}'),
    ('风控告警', '{t("settings.riskAlerts")}'),
    ('>版本<', '>{t("settings.version")}<'),
    ('>平台<', '>{t("settings.platform")}<'),
    ('>数据库<', '>{t("settings.database")}<'),
    ('SQLite (WAL)', '{t("settings.sqliteWal")}'),
]

f = 'src/components/settings/SettingsPage.tsx'
with open(f, 'r', encoding='utf-8') as fh:
    content = fh.read()

changes = 0
for old, new in pairs:
    new_content = content.replace(old, new)
    if new_content != content:
        content = new_content
        changes += 1
        print(f'  {old[:30]} -> {new[:30]}')

with open(f, 'w', encoding='utf-8') as fh:
    fh.write(content)
print(f'Done: {changes} replacements')
