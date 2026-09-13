-- ============================================================
-- 爱的飞行员 · 剧情配置表
-- 在 Supabase Dashboard → SQL Editor 中执行一次即可
--
-- 用途：story-config.html（台词配置页）把全部剧情组保存到本表，
--       level1 等关卡页启动时读取，多设备共享同一份剧情。
-- 结构：单行配置，id=1，data = { active: 激活组名, groups: { 组名: { lines: {...} } } }
-- 策略：遵循项目规范 —— 公开读 + 认证写（见 ARCHITECTURE.md「RLS 策略规则」）
-- ============================================================

create table if not exists plane_story (
  id int primary key default 1,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 预置单行（首次执行后台词配置页即可读写）
insert into plane_story (id, data) values (1, '{"active":"默认","groups":{}}'::jsonb)
on conflict (id) do nothing;

alter table plane_story enable row level security;

-- 公开读：关卡页 / 台词配置页匿名即可拉取剧情
create policy "plane_story 公开读" on plane_story
  for select using (true);

-- 认证写：台词配置页保存时需处于登录态（与主应用同源自动沿用登录）
-- 编辑器保存使用 upsert，需同时具备 insert 与 update 权限
create policy "plane_story 认证插入" on plane_story
  for insert to authenticated with check (true);
create policy "plane_story 认证更新" on plane_story
  for update to authenticated using (true) with check (true);
