export function loader() {
  return new Response(
    [
      'User-agent: *',
      'Allow: /',
      '',
      'Sitemap: https://mediapeek.plnk.workers.dev/sitemap.xml',
    ].join('\n'),
    {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'public, max-age=3600',
      },
    },
  );
}
