# Stage 1: Build the Client
FROM node:22-slim AS client-builder
WORKDIR /app/client
COPY playwright-studio/client/package*.json ./
RUN npm install
COPY playwright-studio/client/ ./
RUN npm run build

# Stage 2: Build the Server
FROM node:22-slim AS server-builder
WORKDIR /app/server
COPY playwright-studio/server/package*.json ./
RUN npm install
COPY playwright-studio/server/ ./
RUN npm run build

# Stage 3: Production Image
FROM mcr.microsoft.com/playwright:v1.48.0-focal AS runner
WORKDIR /app

# Set environment defaults
ENV NODE_ENV=production
ENV PORT=3000
ENV PROJECTS_BASE_PATH=/app/data/projects
ENV EXECUTIONS_BASE_PATH=/app/data/executions
ENV DATABASE_PATH=/app/data/sqlite.db

# Install server production dependencies
WORKDIR /app/server
COPY playwright-studio/server/package*.json ./
RUN npm install --omit=dev

# Copy server build and migrations
COPY --from=server-builder /app/server/dist ./dist
COPY playwright-studio/server/drizzle ./drizzle

# Copy client build to server static folder
COPY --from=client-builder /app/client/dist /app/server/static

# Create data directories
RUN mkdir -p /app/data/projects /app/data/executions

# Expose the application port
EXPOSE 3000

# Start the server
CMD ["node", "dist/index.js"]
