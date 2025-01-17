# Stage 1: Build
FROM node:18

# Set the working directory in the container
WORKDIR /app

# Copy package.json and yarn.lock to install dependencies
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy the entire application to the working directory
COPY . .

# Command to run your TypeScript code
CMD ["yarn", "start"]