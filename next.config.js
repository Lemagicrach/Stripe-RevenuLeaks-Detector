/** @type {import('next').NextConfig} */

// Définition de l'URL de base pour les configurations.
// Utilisera la variable d'environnement sur Vercel, ou une valeur par défaut.
const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://revpilot-net.vercel.app'; 

const nextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**.stripe.com',
            },
            {
                protocol: 'https',
                hostname: '**.supabase.co',
            },
        ],
    },
    
    async headers() {
        
        // --- 1. CONFIGURATION CSP (Content Security Policy) ---
        const connectSrcDomains = [
            "'self'",
            "https://*.supabase.co", 
            "https://api.stripe.com",
            "https://vercel.live",
            "wss://*.supabase.co",
            "https://va.vercel-scripts.com",
            // Autorise le domaine de production principal
            NEXT_PUBLIC_APP_URL, 
            // 🛑 OPTIMISATION : Autoriser n'importe quel domaine Vercel pour les tests de prévisualisation
            "https://*.vercel.app", 
        ];

        const cspHeader = {
            key: 'Content-Security-Policy',
            value: `
                default-src 'self';
                script-src 'self' 'unsafe-eval' 'unsafe-inline'; 
                style-src 'self' 'unsafe-inline';
                img-src 'self' data: https: ${connectSrcDomains.join(' ').replace(/'/g, "")}; 
                
                connect-src ${connectSrcDomains.join(' ')};
            `.replace(/\s+/g, ' ').trim(),
        };

        // --- 2. CONFIGURATION CORS (Cross-Origin Resource Sharing) ---
        
        // 🛑 CORRECTION POUR LES TESTS DE PRÉVISUALISATION : 
        // L'origine à autoriser doit être dynamique ou un joker pour les sous-domaines Vercel.
        // Utiliser le joker '*' pour autoriser temporairement toutes les requêtes (développement/test).
        const allowedOrigin = process.env.NODE_ENV !== 'production' 
                              ? '*' 
                              : NEXT_PUBLIC_APP_URL;

        const corsHeaders = [
            // Utilisation de l'origine dynamique
            { key: 'Access-Control-Allow-Origin', value: allowedOrigin }, 
            { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
            { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
            { key: 'Access-Control-Allow-Credentials', value: 'true' }, 
        ];

        // --- RETOURNER TOUS LES EN-TÊTES ---
        return [
            {
                source: '/(.*)',
                // Fusionner les en-têtes CSP et CORS
                headers: [cspHeader, ...corsHeaders], 
            },
        ];
    },

    // 💡 Optionnel: Redirections pour gérer les slashes de fin sur les API
    /*
    async redirects() {
      return [
        {
          source: '/api/(.*)/', 
          destination: '/api/$1',
          permanent: true,
        },
      ];
    },
    */
};

module.exports = nextConfig;