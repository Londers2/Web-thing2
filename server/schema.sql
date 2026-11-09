CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  avatar_path TEXT,
  avatar_mime VARCHAR(100),
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(160) NOT NULL,
  call_sign VARCHAR(120),
  email VARCHAR(255),
  phone VARCHAR(50),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS price_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS price_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
  category VARCHAR(160) NOT NULL DEFAULT 'Услуги',
  name VARCHAR(500) NOT NULL,
  price NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number BIGSERIAL UNIQUE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  address TEXT,
  price_list_id UUID REFERENCES price_lists(id),
  status VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'done', 'cancelled')),
  amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  deadline DATE,
  client_id UUID NOT NULL REFERENCES clients(id),
  creator_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_members (
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (order_id, user_id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  task_type VARCHAR(20) NOT NULL DEFAULT 'measurement' CHECK (task_type IN ('measurement', 'delivery', 'assembly', 'complaint')),
  due_date DATE NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_members (
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, user_id)
);

CREATE TABLE IF NOT EXISTS order_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL UNIQUE,
  mime_type VARCHAR(100) NOT NULL,
  size BIGINT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_price_items (
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  price_item_id UUID NOT NULL REFERENCES price_list_items(id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (order_id, price_item_id)
);

CREATE TABLE IF NOT EXISTS order_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  body TEXT NOT NULL DEFAULT '',
  attachment_path TEXT,
  attachment_name TEXT,
  attachment_mime VARCHAR(150),
  attachment_duration INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT message_content_check CHECK (char_length(body) <= 4000 AND (char_length(body) > 0 OR attachment_path IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS message_reads (
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id)
);

CREATE TABLE IF NOT EXISTS message_reactions (
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS unavailable_days (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  reason VARCHAR(300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, date)
);

INSERT INTO app_settings (key, value) VALUES ('assembly_percent', '10'), ('page_size', '10') ON CONFLICT (key) DO NOTHING;

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_path TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_mime VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS job_role VARCHAR(30) NOT NULL DEFAULT 'manager';
ALTER TABLE users ADD COLUMN IF NOT EXISTS job_roles TEXT[] NOT NULL DEFAULT '{manager}';
UPDATE users SET job_roles = ARRAY[job_role] WHERE job_role IS NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS accent_color VARCHAR(20) NOT NULL DEFAULT 'blue';
UPDATE users SET accent_color = 'blue' WHERE accent_color = 'zinc';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS call_sign VARCHAR(120);
ALTER TABLE price_lists ADD COLUMN IF NOT EXISTS print_title TEXT;
ALTER TABLE price_list_items ADD COLUMN IF NOT EXISTS kind VARCHAR(20) NOT NULL DEFAULT 'service';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS advance_amount NUMERIC(14, 2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS assembly_amount NUMERIC(14, 2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS address_lat DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS address_lng DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS price_list_id UUID REFERENCES price_lists(id);
ALTER TABLE order_members ADD COLUMN IF NOT EXISTS can_edit BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_size BIGINT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS transcript TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_type VARCHAR(20) NOT NULL DEFAULT 'measurement';
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_task_type_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_task_type_check CHECK (task_type IN ('measurement', 'delivery', 'assembly', 'complaint'));
ALTER TABLE messages ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_path TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_name TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_mime VARCHAR(150);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_duration INTEGER;
ALTER TABLE messages ALTER COLUMN body SET DEFAULT '';
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_body_check;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS message_content_check;
UPDATE messages SET body = 'Вложение' WHERE body = '' AND attachment_path IS NULL;
ALTER TABLE messages ADD CONSTRAINT message_content_check CHECK (char_length(body) <= 4000 AND (char_length(body) > 0 OR attachment_path IS NOT NULL));
ALTER TABLE order_images ALTER COLUMN size TYPE BIGINT;

CREATE INDEX IF NOT EXISTS order_members_user_idx ON order_members(user_id, order_id);
CREATE INDEX IF NOT EXISTS task_members_user_idx ON task_members(user_id, task_id);
CREATE INDEX IF NOT EXISTS orders_client_idx ON orders(client_id);
CREATE INDEX IF NOT EXISTS order_activities_idx ON order_activities(order_id, created_at);
CREATE INDEX IF NOT EXISTS price_items_list_idx ON price_list_items(list_id, position);
CREATE INDEX IF NOT EXISTS tasks_order_due_idx ON tasks(order_id, due_date);
CREATE INDEX IF NOT EXISTS tasks_due_idx ON tasks(due_date);
CREATE INDEX IF NOT EXISTS messages_order_idx ON messages(order_id, created_at) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS messages_direct_idx ON messages(recipient_id, user_id, created_at) WHERE recipient_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS message_reads_user_idx ON message_reads(user_id, message_id);
CREATE INDEX IF NOT EXISTS message_reactions_message_idx ON message_reactions(message_id);
