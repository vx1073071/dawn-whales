f = 'src/components/layout/Header.tsx'
with open(f, 'r', encoding='utf-8') as fh:
    content = fh.read()

# Replace Chinese hardcoded strings
content = content.replace('折叠侧边栏 (Ctrl+B)', "{t('components.collapseSidebar')}")
content = content.replace('alt="道鲸"', 'alt={t("common.appName")}')
content = content.replace('道鲸·AI量化系统', "{t('components.appFullName')}")
content = content.replace('"切换到浅色模式"', "t('components.switchToLight')")
content = content.replace('"切换到深色模式"', "t('components.switchToDark')")
content = content.replace('"语言 / Language"', '{t("components.languageSelector")}')
content = content.replace('紧急停止所有策略', "{t('components.emergencyStopAll')}")

with open(f, 'w', encoding='utf-8') as fh:
    fh.write(content)
print('Header i18n done')
