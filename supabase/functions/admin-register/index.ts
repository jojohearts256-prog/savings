import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      email,
      password,
      full_name,
      phone,
      role,
      id_number,
      address,
      date_of_birth,
      user_id,
    } = await req.json();

    let currentUserId = user_id;

    // ✅ Step 1: Check or create auth user
    if (!currentUserId) {
      const { data: existingUserData, error: existingUserError } =
        await supabase.auth.admin.listUsers();
      if (existingUserError) throw existingUserError;

      const existingUser = existingUserData.users.find((u) => u.email === email);

      if (existingUser) {
        currentUserId = existingUser.id;
      } else {
        const { data: authData, error: authError } =
          await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
          });
        if (authError) throw authError;
        currentUserId = authData.user.id;
      }
    }

    // ✅ Step 2: Create or update profile
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", currentUserId)
      .maybeSingle();

    if (!existingProfile) {
      const { error: profileError } = await supabase.from("profiles").insert({
        id: currentUserId,
        email,
        full_name,
        phone,
        role,
        id_number,
        address,
        date_of_birth,
      });
      if (profileError) throw profileError;
    } else {
      const { error: updateProfileError } = await supabase
        .from("profiles")
        .update({
          full_name,
          phone,
          id_number,
          address,
          date_of_birth,
        })
        .eq("id", currentUserId);
      if (updateProfileError) throw updateProfileError;
    }

    // ✅ Step 3: Create or update member record
    if (role === "member") {
      const { data: existingMember } = await supabase
        .from("members")
        .select("id")
        .eq("profile_id", currentUserId)
        .maybeSingle();

      if (!existingMember) {
        const { data: memberNumberData } = await supabase.rpc(
          "generate_member_number"
        );

        const { error: memberError } = await supabase.from("members").insert({
          profile_id: currentUserId,
          member_number: memberNumberData,
          full_name,
          email,
          phone,
          address,
          date_of_birth,
          id_number,
          status: "active",
          account_balance: 0,
        });
        if (memberError) throw memberError;
      } else {
        // ✅ Update existing member
        const { error: updateMemberError } = await supabase
          .from("members")
          .update({
            full_name,
            email,
            phone,
            address,
            date_of_birth,
            id_number,
          })
          .eq("profile_id", currentUserId);
        if (updateMemberError) throw updateMemberError;
      }
    }

    // ✅ Step 4: Two-way synchronization logic
    // Keep both tables always consistent
    // (If the profile exists but member doesn’t, create; if both exist, make sure fields match)

    const { data: memberCheck } = await supabase
      .from("members")
      .select("*")
      .eq("profile_id", currentUserId)
      .maybeSingle();

    const { data: profileCheck } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", currentUserId)
      .maybeSingle();

    if (memberCheck && profileCheck) {
      // 🔁 Ensure data consistency both ways
      await supabase
        .from("profiles")
        .update({
          full_name: memberCheck.full_name || profileCheck.full_name,
          phone: memberCheck.phone || profileCheck.phone,
          id_number: memberCheck.id_number || profileCheck.id_number,
          address: memberCheck.address || profileCheck.address,
          date_of_birth: memberCheck.date_of_birth || profileCheck.date_of_birth,
        })
        .eq("id", currentUserId);

      await supabase
        .from("members")
        .update({
          full_name: profileCheck.full_name || memberCheck.full_name,
          phone: profileCheck.phone || memberCheck.phone,
          id_number: profileCheck.id_number || memberCheck.id_number,
          address: profileCheck.address || memberCheck.address,
          date_of_birth: profileCheck.date_of_birth || memberCheck.date_of_birth,
        })
        .eq("profile_id", currentUserId);
    }

    // ✅ Success Response
    return new Response(
      JSON.stringify({
        success: true,
        user_id: currentUserId,
        email,
        id_number,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in admin-register:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
