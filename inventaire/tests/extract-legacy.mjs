// Read-only extraction used to verify the 2026-09 catalogue against its Git source.
export function extractLegacy(html) {
  const decode = text => text.replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  const clean = text => decode(text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  const categories = [...html.matchAll(/<tr class="category-header" data-category="([^"]+)"[^>]*>\s*<td[^>]*>([^<]+)/g)]
    .map(match => ({ id: match[1], name: clean(match[2]) }));
  const articles = [...html.matchAll(/<tr\b[^>]*class="[^"]*article-row[^"]*"[^>]*>[\s\S]*?<\/tr>/g)].map((match, order) => {
    const row = match[0];
    const attr = name => decode((row.match(new RegExp(name + '="([^"]*)"')) || [,''])[1]);
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[1]);
    return {
      id: attr('data-id'), name: clean(cells[0]),
      category: categories.find(c => attr('class').split(/\s+/).includes(c.id))?.id || 'divers',
      barcodes: attr('data-barcode').split(',').map(b => b.trim()).filter(Boolean),
      image: decode((cells[1].match(/src="([^"]+)"/) || [,''])[1]),
      minStock: Number(clean(cells[3])), order
    };
  });
  if (articles.length !== 268 || new Set(articles.map(a => a.id)).size !== 268 || articles.some(a => !a.name || !Number.isFinite(a.minStock))) {
    throw new Error('Unexpected legacy catalogue; do not generate automatically.');
  }
  return { categories, articles };
}
