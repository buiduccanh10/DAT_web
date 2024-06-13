# Use Node.js image as the base image
FROM node:18

# Set the working directory in the container
WORKDIR /app

# Copy entire project directory to the working directory
COPY . /app

# Install dependencies based on package.json
RUN npm install

# Expose port 3000 for the application
EXPOSE 3000

# Start the application
CMD ["npm", "start"]