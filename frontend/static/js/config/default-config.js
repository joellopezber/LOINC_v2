export const DEFAULT_CONFIG = {
    search: {
        ontologyMode: 'multi_match',  // 'multi_match' | 'openai'
        dbMode: 'sql',                // 'sql' | 'elastic'
        openai: {
            useOriginalTerm: true,
            useEnglishTerm: true,
            useRelatedTerms: false,
            useTestTypes: false,
            useLoincCodes: false,
            useKeywords: true
        }
    },
    sql: {
        maxTotal: 150,
        maxPerKeyword: 100,
        maxKeywords: 10,
        strictMode: true
    },
    elastic: {
        limits: {
            maxTotal: 50,
            maxPerKeyword: 10
        },
        searchTypes: {
            exact: {
                enabled: false,
                priority: 10
            },
            fuzzy: {
                enabled: false,
                tolerance: 2
            },
            smart: {
                enabled: false,
                precision: 7
            }
        },
        showAdvanced: false
    },
    performance: {
        maxCacheSize: 100,  // MB
        cacheExpiry: 24     // horas
    }
}; 