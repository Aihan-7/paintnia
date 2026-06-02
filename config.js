/* =========================================================
   thepaint.nia — CLOUD CONFIG
   ---------------------------------------------------------
   Paste your two Supabase values below (see SETUP.md, step 4).
   Until you do, the site happily falls back to gallery.js, so
   nothing breaks while you set things up.

   Both values are SAFE to be public (the anon key is designed
   to be shared — your data is protected by login rules).
   ========================================================= */
window.NIA_CONFIG = {
  supabaseUrl: "https://hqqobdufquvbederpute.supabase.co",
  supabaseAnonKey: "sb_publishable_OMLkFmoirpt5BZsB2qcyyw_LIkhPJ_8",

  // Nia logs in with a username (not an email). It's turned into an email
  // behind the scenes by adding this domain — so username "nia" becomes the
  // login email "nia@thepaint.art". When you create her account in Supabase
  // (SETUP.md, step 3), use that exact email.
  loginDomain: "thepaint.art"
};
