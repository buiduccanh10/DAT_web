# Use Node.js image as the base image
FROM node:18

# Set the working directory in the container
WORKDIR /app

# Copy entire project directory to the working directory
COPY . /app

# Install dependencies based on package.json
RUN npm install

# Expose port 4000 for the application (app.js lắng nghe PORT || 4000)
EXPOSE 4000

# Start the application
CMD ["npm", "start"]