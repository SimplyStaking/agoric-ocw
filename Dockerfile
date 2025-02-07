# Stage 1: Build
FROM node:18 AS builder

# Set the working directory in the container
WORKDIR /app

# Copy package.json and yarn.lock to install dependencies
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy the entire application to the working directory
COPY . .

# Stage 2: Runtime
FROM node:18-bookworm-slim

# Fix vulnerabilities
RUN apt-get update && apt-get install --only-upgrade libc6 libgnutls30 iproute2 perl systemd

# Set the working directory in the container
WORKDIR /app

# Copy build output and node_modules from the builder stage
COPY --from=builder /app /app

# Command to run your TypeScript code
CMD ["yarn", "start"]