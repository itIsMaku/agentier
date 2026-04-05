import { defineConfig } from 'vitepress'

export default defineConfig({
    title: 'Agentier',
    description: 'TypeScript framework for building AI agent loops',
    base: '/agentier/',

    head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/agentier/logo.svg' }]],

    themeConfig: {
        nav: [
            { text: 'Guide', link: '/guide/getting-started' },
            { text: 'API', link: '/api/core' },
            {
                text: '0.1.1',
                items: [
                    {
                        text: 'Changelog',
                        link: 'https://github.com/itIsMaku/agentier/releases',
                    },
                ],
            },
        ],

        sidebar: {
            '/guide/': [
                {
                    text: 'Introduction',
                    items: [
                        { text: 'What is Agentier?', link: '/guide/what-is-agentier' },
                        { text: 'Getting Started', link: '/guide/getting-started' },
                    ],
                },
                {
                    text: 'Core Concepts',
                    items: [
                        { text: 'Agent Loop', link: '/guide/agent-loop' },
                        { text: 'Tools', link: '/guide/tools' },
                        { text: 'Providers', link: '/guide/providers' },
                        { text: 'Middleware', link: '/guide/middleware' },
                        { text: 'Memory', link: '/guide/memory' },
                        { text: 'Structured Output', link: '/guide/structured-output' },
                    ],
                },
            ],
            '/api/': [
                {
                    text: 'API Reference',
                    items: [
                        { text: '@agentier/core', link: '/api/core' },
                        { text: '@agentier/openai', link: '/api/openai' },
                        { text: '@agentier/anthropic', link: '/api/anthropic' },
                        { text: '@agentier/google', link: '/api/google' },
                        { text: '@agentier/middleware', link: '/api/middleware' },
                        { text: '@agentier/memory', link: '/api/memory' },
                        { text: '@agentier/tools', link: '/api/tools' },
                    ],
                },
            ],
        },

        socialLinks: [{ icon: 'github', link: 'https://github.com/itIsMaku/agentier' }],

        footer: {
            message: 'Released under the MIT License.',
            copyright: 'Copyright © 2026 Agentier Contributors',
        },

        search: {
            provider: 'local',
        },
    },
})
