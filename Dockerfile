FROM  node:6
MAINTAINER Sven Sterbling

LABEL name="WCH Conversation Server"

EXPOSE 6001

# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json .

RUN npm install

# Copy the application files
COPY bin/* ./bin/
COPY lib/ ./lib/
COPY routes/* ./routes/
COPY app.js .
COPY app_settings.json .
COPY dch_vcap.json .

# make sure the shell scripts are executable
# RUN chmod +x /usr/bin/*

# kick off the start shell script
CMD  ["node", "bin/www"]
