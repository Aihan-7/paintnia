# 🎨 thepaint.nia — one-time cloud setup (≈15 min)

This connects the site to a **free Supabase database** so Nia can add art from her
phone and have it appear **instantly** — no files, no GitHub, no re-uploading.

You only do this once. Nia never sees any of it.

> Everything here is on the **free tier** and needs **no credit card**.

---

## Step 1 — Create the project

1. Go to **https://supabase.com** → **Start your project** → sign in (GitHub or Google).
2. Click **New project**.
   - **Name:** `thepaint-nia` (anything)
   - **Database Password:** click *Generate*, then save it somewhere (you likely won't need it again).
   - **Region:** pick the one closest to you.
3. Click **Create new project** and wait ~1 minute while it sets up.

---

## Step 2 — Create the table + image storage (one paste)

1. In the left sidebar, click **SQL Editor** → **+ New query**.
2. Paste in **everything** below and click **Run**. You should see *Success*.

```sql
-- Art pieces table -------------------------------------------------
create table if not exists public.pieces (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  sort_order double precision default 0,
  title text not null,
  medium text default '',
  description text default '',
  image_url text default '',
  price text default '',
  status text default 'available',
  section text default 'collection'
);

alter table public.pieces enable row level security;

drop policy if exists "public read pieces"   on public.pieces;
drop policy if exists "authed write pieces"   on public.pieces;
create policy "public read pieces" on public.pieces for select using (true);
create policy "authed write pieces" on public.pieces for all
  to authenticated using (true) with check (true);

-- Image storage bucket --------------------------------------------
insert into storage.buckets (id, name, public)
values ('art', 'art', true)
on conflict (id) do nothing;

drop policy if exists "public read art"  on storage.objects;
drop policy if exists "authed write art" on storage.objects;
create policy "public read art" on storage.objects for select using (bucket_id = 'art');
create policy "authed write art" on storage.objects for all
  to authenticated using (bucket_id = 'art') with check (bucket_id = 'art');

-- Start with Nia's current 5 pieces (only if the table is empty) ---
do $$
begin
  if not exists (select 1 from public.pieces) then
    insert into public.pieces (sort_order, title, medium, description, image_url, section) values
      (1, 'Swan Study',        'Acrylic on canvas',     'Two swans in expressive brushwork with bold contrast and a moody forest palette.', 'assets/swan-study.jpg',        'collection'),
      (2, 'Headphones Bunny',  'Gouache · mini artwork','A cute mini character study — perfect for prints, gifts, and custom characters.', 'assets/headphones-bunny.jpg',  'collection'),
      (3, 'Birthday Card Art', 'Marker illustration',   'A custom celebration illustration in a playful comic-panel layout with soft pop colors.', 'assets/birthday-card-art.jpeg', 'collection'),
      (4, 'Rose Skull Sketch', 'Graphite on paper',     'Tattoo-inspired graphite linework — a skull wrapped in roses and petals.', 'assets/rose-skull-sketch.jpg', 'collection'),
      (5, 'Style Icons',       'Pencil studies',        'Fashion-inspired outfit studies — soft pencil shading and lots of little details.', 'assets/style-icons-sketch.jpg', 'sketchbook');
  end if;
end $$;
```

---

## Step 3 — Make Nia's login

Nia logs in with a simple **username** (e.g. `nia`), not an email. Supabase needs an
email behind the scenes, so the username gets turned into one by adding the `loginDomain`
from `config.js` — by default `nia` → **`nia@thepaint.art`**.

1. Left sidebar → **Authentication** → **Users** → **Add user** → **Create new user**.
2. For **Email**, enter the username + domain, e.g. **`nia@thepaint.art`**
   (i.e. `<her-username>@<loginDomain>`). It doesn't need to be a real inbox.
3. Set a **password** (pick a simple one for her).
4. Tick **Auto Confirm User** so she can log in right away → **Create user**.

Then just tell Nia her **username** (`nia`) and **password** — that's all she types into the Studio. 💛

> Want a different username or domain? Change `loginDomain` in `config.js` and use the
> matching email here. (If you'd rather she just use a normal email, that works too —
> create the user with her real email and she can type the whole thing in the username box.)

---

## Step 4 — Connect the site

1. Left sidebar → **Project Settings** (gear) → **API**.
2. Copy two things:
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - **anon public** key (a long string under *Project API keys*)
3. Open **`config.js`** in the site folder and paste them in:

```js
window.NIA_CONFIG = {
  supabaseUrl: "https://abcd1234.supabase.co",
  supabaseAnonKey: "paste-the-long-anon-public-key-here"
};
```

> Both values are **safe to be public** — the anon key is meant to be shared, and your
> data is protected by the login rules from Step 2.

---

## Step 5 — Publish

Commit/push the updated files to your GitHub repo (GitHub Pages will redeploy automatically):

- `config.js` (with your keys)
- `studio.html`, `index.html`, `script.js` (already updated)

Once it's live, that's the **last time you touch GitHub** for adding art. 🎉

---

## ✅ How Nia adds art (the whole point!)

1. On her phone, go to **`your-site-address/studio.html`** and **add it to her home screen** (bookmark it).
2. Log in once (the email + password from Step 3) — she'll stay logged in.
3. Tap **Add a photo** → pick from her camera roll → type a title → **Add piece**.
4. It's **live on the site immediately**. ✨ (She can tap **View site** to see it.)

She can also edit, reorder, mark pieces **Sold**, or delete — all from her phone.

---

### Good to know
- **Free limits** are huge for a portfolio (500MB database + 1GB image storage). You won't get near them.
- Supabase may **pause** a free project after ~1 week of zero traffic; if the gallery ever looks empty, just open the Supabase dashboard once to wake it (the site keeps showing the offline `gallery.js` pieces in the meantime, so it never looks broken).
- Want the gallery photos in `gallery.js` (the offline fallback) refreshed too? Not required — it's only a safety net.
