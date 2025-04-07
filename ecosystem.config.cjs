// ecosystem.config.cjs
module.exports = {
    apps: [{
        name: "chatgpt-ghibli-flow",
        script: "pnpm", // Keep pnpm if solution 1 didn't work or isn't applicable
        args: "start",
        interpreter: 'none',
        cwd: __dirname,
        env: {
            "NODE_ENV": "production",
            "TERM": "dumb" // <--- Add this
        }
    }]
}
