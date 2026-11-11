-- New landing-page template "PFAS by Apple" (2026-11-11): Apple-style article /
-- listicle. An article header instead of a hero, numbered <section class="item">
-- blocks, a closing form and a sources list. Detected by classifyTemplate
-- (_shared/funnelTemplate.ts) from 3+ "item" sections. First page: Culligan
-- Rochester /rochester-pfas.

insert into public.funnel_templates (key, name, description, sections, status, sort_order) values
  ('listicle', 'PFAS by Apple',
   'Apple-style article: a headline-first read in numbered items, each with a highlighted line, an animated visual and body copy, local water data with sources, inline CTAs and a short zip → name + phone form that hands off to the booking page.',
   array['article-header', 'item', 'item', 'item', 'item', 'item', 'item', 'item', 'close', 'sources'], 'active', 4)
on conflict (key) do update set name = excluded.name, description = excluded.description, sections = excluded.sections;
