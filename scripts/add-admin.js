#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// Load .env.local if present
const envPath = path.resolve(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx !== -1) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const email = process.argv[2] || "admin@ua.edu.ph";
const password = process.argv[3] || "masteradmin2526";
const firstName = process.argv[4] || "System";
const lastName = process.argv[5] || "Admin";
const role = process.argv[6] || "administrator";

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log(`Connecting to Supabase at ${supabaseUrl}...`);
  console.log(`Configuring admin user: ${email} (Role: ${role})...`);

  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) throw listErr;

  let user = users.find((u) => u.email && u.email.toLowerCase() === email.toLowerCase());

  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName },
    });
    if (error) throw error;
    user = data.user;
    console.log(`Created user in Supabase Auth (ID: ${user.id})`);
  } else {
    const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
    });
    if (error) throw error;
    user = data.user;
    console.log(`Updated user password in Supabase Auth (ID: ${user.id})`);
  }

  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email: user.email,
        first_name: firstName,
        last_name: lastName,
        role,
        status: "active",
      },
      { onConflict: "id" }
    )
    .select();

  if (profErr) throw profErr;
  console.log("Configured admin profile in public.profiles:", profile?.[0]);
  console.log("\nSuccess! You can sign in via the admin modal with:");
  console.log(`  Username: ${email.startsWith("admin") ? "admin or " + email : email}`);
  console.log(`  Password: ${password}\n`);
}

main().catch((err) => {
  console.error("Failed to configure admin user:", err);
  process.exit(1);
});
