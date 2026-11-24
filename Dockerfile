# The table timer as a container, for any host that runs one (Fly.io, Render, Railway, a VM).
# Build from this folder. Mount a volume at /data so the state survives a restart.
# The game master page has no key: don't put this on a public address without a password in front of it (see README).
FROM node:22-alpine
WORKDIR /app
COPY server.js content.json ./
COPY public ./public
ENV PORT=8080 AIGI_STATE=/data/state.json
RUN mkdir -p /data
EXPOSE 8080
CMD ["node", "server.js"]
