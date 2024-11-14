# Stage 1: Run the application
FROM node:18

# Set the working directory in the container
WORKDIR /app

# Copy package.json and yarn.lock to install dependencies
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy the rest of the application code
COPY . .

# Run the application
CMD ["yarn", "start"]
