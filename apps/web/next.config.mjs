/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@ayon/ui", "@ayon/core", "@ayon/types"],
  // pdf-parse (usado por @ayon/core para extração de texto — Missão 4) faz
  // acesso a `fs` que o webpack não consegue empacotar; roda só em Node
  // runtime (Server Actions), nunca em client/edge, então basta não empacotar.
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse"],
  },
};

export default nextConfig;
