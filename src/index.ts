import { Plugin, UserConfig } from 'vite';
import camelcase from 'camelcase';

type ManualChunks = Record<string, string[]>;

type Expression = string | string[];

type ExpressionArray = Expression[];

type Patterns = 'prefix' | 'suffix' | 'include';

type PatternFunc = String['startsWith'] | String['endsWith'] | String['includes'];

interface ManualChunksCompletionOptions {
    dependencies: Record<string, string>;
    patterns: Partial<Record<Patterns, ExpressionArray>>;
}

export default function ManualChunksCompletionPlugin(options: ManualChunksCompletionOptions): Plugin {
    const { dependencies, patterns } = options || {};
    const { prefix, suffix, include } = patterns || {};

    const depList = Object.keys(dependencies || {});

    function getMatchedDeps(exp: Expression, patternFn: PatternFunc) {
        let chunkKey: string;
        let matchString: string;

        if (Array.isArray(exp)) {
            [matchString, chunkKey] = exp;
        } else {
            chunkKey = camelcase(exp.startsWith('@') ? exp.slice(1) : exp);
            matchString = exp;
        }

        const matched = depList.filter((dep) => patternFn.call(dep, matchString));

        return {
            chunkKey,
            matched,
        };
    }

    function getChunks(expArray: ExpressionArray, patternFn: PatternFunc) {
        const chunks: ManualChunks = {};
        const excludeDeps: string[] = [];

        expArray.forEach((exp) => {
            const { chunkKey, matched } = getMatchedDeps(exp, patternFn);
            chunks[chunkKey] = matched;
            excludeDeps.push(...matched);
        });

        return {
            chunks,
            excludeDeps,
        };
    }

    function run(): ManualChunks {
        let prefixChunks: ManualChunks = {};
        let suffixChunks: ManualChunks = {};
        let includeChunks: ManualChunks = {};
        const excludeDependencies: string[] = [];

        if (prefix) {
            const { chunks, excludeDeps } = getChunks(prefix, String.prototype.startsWith);
            prefixChunks = chunks;
            excludeDependencies.push(...excludeDeps);
        }

        if (suffix) {
            const { chunks, excludeDeps } = getChunks(suffix, String.prototype.endsWith);
            suffixChunks = chunks;
            excludeDependencies.push(...excludeDeps);
        }

        if (include) {
            const { chunks, excludeDeps } = getChunks(include, String.prototype.includes);
            includeChunks = chunks;
            excludeDependencies.push(...excludeDeps);
        }

        return {
            ...prefixChunks,
            ...suffixChunks,
            ...includeChunks,
            vendor: depList.filter((dep) => !excludeDependencies.includes(dep)),
        };
    }

    return {
        name: 'vite-plugin-manual-chunks-completion',
        config(): UserConfig {
            const manualChunks = run();

            return {
                build: {
                    rollupOptions: {
                        output: {
                            manualChunks,
                        },
                    },
                },
            };
        },
    };
}
