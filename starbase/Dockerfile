FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY server ./server
COPY public ./public
COPY website ./website
ENV NODE_ENV=production PORT=8080 STARBASE_DB=/app/data/starbase.db
RUN mkdir -p /app/data && chown node:node /app/data
VOLUME /app/data
EXPOSE 8080
USER node
CMD ["node", "--disable-warning=ExperimentalWarning", "server/index.js"]
