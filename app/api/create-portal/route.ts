// /api/create-portal/route.ts

import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { headers, cookies } from "next/headers";
import { stripe } from "@/lib/stripe"; // Assurez-vous que ce chemin est correct

export async function POST() {
    try {
        const supabase = createRouteHandlerClient({ cookies });
        
        // 1. Récupérer l'utilisateur de la session Supabase
        const { data: userSession } = await supabase.auth.getSession();

        if (!userSession.session) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }

        const userId = userSession.session.user.id;

        // 2. Récupérer l'ID Client Stripe depuis le profil de l'utilisateur
        const { data: profile, error: profileError } = await supabase
            .from("user_profiles")
            .select("stripe_customer_id")
            .eq("user_id", userId)
            .maybeSingle();

        if (profileError || !profile?.stripe_customer_id) {
            console.error("❌ Profile or Stripe Customer ID not found:", profileError);
            return new Response(JSON.stringify({ error: "Customer ID not found in profile." }), { status: 404 });
        }

        const stripeCustomerId = profile.stripe_customer_id;
        const requestHeaders = await headers();
        const returnUrl = requestHeaders.get('origin') || process.env.NEXT_PUBLIC_BASE_URL;

        // 3. Créer la session du portail de facturation
        const portalSession = await stripe.billingPortal.sessions.create({
            customer: stripeCustomerId,
            return_url: `${returnUrl}/dashboard/billing`,
        });

        console.log(`✅ Stripe Portal Session created for Customer: ${stripeCustomerId}`);
        
        return new Response(JSON.stringify({ url: portalSession.url }), { status: 200 });

    } catch (error) {
        console.error("❌ Error creating billing portal session:", error);
        return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
    }
}
