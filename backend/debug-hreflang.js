// 调试 Hreflang 检测逻辑
const hreflangLinks = [
  { lang: 'en-US', href: 'https://www.anker.com/' },
  { lang: 'en-GB', href: 'https://www.anker.com/uk' },
  { lang: 'en-CA', href: 'https://www.anker.com/ca' },
  { lang: 'de-DE', href: 'https://www.anker.com/eu-de' },
  { lang: 'en-DE', href: 'https://www.anker.com/eu-en' },
  { lang: 'fr-FR', href: 'https://www.anker.com/fr' },
  { lang: 'en-AU', href: 'https://www.anker.com/au' },
  { lang: 'en-NZ', href: 'https://www.anker.com/nz' },
  { lang: 'es-ES', href: 'https://www.anker.com/es' },
  { lang: 'it-IT', href: 'https://www.anker.com/it' },
  { lang: 'nl-NL', href: 'https://www.anker.com/nl' },
  { lang: 'pl-PL', href: 'https://www.anker.com/eu-pl' },
  { lang: 'fr-CA', href: 'https://www.anker.com/fr' }, // 注意: 与 fr-FR 指向相同URL
];

console.log('Total links:', hreflangLinks.length);
console.log('\n=== 检查1: 重复的语言代码 ===');

// 当前代码的逻辑: 检测相同的语言代码
const langCounts = new Map();
hreflangLinks.forEach(link => {
  langCounts.set(link.lang, (langCounts.get(link.lang) || 0) + 1);
});

const duplicateLangs = Array.from(langCounts.entries())
  .filter(([, count]) => count > 1)
  .map(([lang]) => lang);

console.log('重复的语言代码:', duplicateLangs);
console.log('结果:', duplicateLangs.length === 0 ? '✅ 无重复' : `❌ 发现 ${duplicateLangs.length} 个重复`);

console.log('\n=== 检查2: 相同URL被多个语言代码指向 ===');

// 检查是否有多个语言代码指向同一个URL
const urlToLangs = new Map();
hreflangLinks.forEach(link => {
  if (!urlToLangs.has(link.href)) {
    urlToLangs.set(link.href, []);
  }
  urlToLangs.get(link.href).push(link.lang);
});

const urlDuplicates = Array.from(urlToLangs.entries())
  .filter(([, langs]) => langs.length > 1);

if (urlDuplicates.length > 0) {
  console.log('⚠️  发现相同URL被多个语言代码指向:');
  urlDuplicates.forEach(([url, langs]) => {
    console.log(`  ${url}`);
    console.log(`    语言代码: ${langs.join(', ')}`);
  });
} else {
  console.log('✅ 无URL重复');
}

console.log('\n=== 检查3: en-US 和 en-GB 是否被误判为重复 ===');
const enUS = hreflangLinks.filter(l => l.lang === 'en-US');
const enGB = hreflangLinks.filter(l => l.lang === 'en-GB');

console.log('en-US 数量:', enUS.length);
console.log('en-GB 数量:', enGB.length);
console.log('结论:',
  enUS.length === 1 && enGB.length === 1
    ? '✅ en-US 和 en-GB 是不同的语言代码,不应判定为重复'
    : '❌ 存在真正的重复'
);
