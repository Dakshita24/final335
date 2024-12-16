
const fs = require('fs');
const readline = require('readline');

const express = require("express");
const path = require("path");
const app = express(); 
const bodyParser = require("body-parser");
require("dotenv").config({ path: path.resolve(__dirname, 'credentials/.env') }) 


"use strict";

const uri = process.env.MONGO_CONNECTION_STRING;
const databaseAndCollection = {db: "CMSC335DB", collection:"choices"};
const { MongoClient, ServerApiVersion } = require('mongodb');

const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

/* directory where templates will reside */
app.set("views", path.resolve(__dirname, "templates"));
/* view/templating engine */
app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({extended:false}));

const portNumber = 5001;


const getAccessToken = async () => {
    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
        }),
    });

    const data = await response.json();
    return data.access_token;
};

// albums - this gets the 20 newest albums  using the spotify api
const getList = async (accessToken) => {
    const response = await fetch('https://api.spotify.com/v1/browse/new-releases?limit=20', {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    const data = await response.json();
    return data.albums.items.map(album => album.name);
};

app.get("/", (request, response) => {
    response.render("home", {
      
    });
});

app.get("/chooseSongs", async (request, response) => { 
    let options = ""; //loop through to get a list of options

    const accessToken = await getAccessToken();

    const tracks = await getList(accessToken);
  
    tracks.forEach(track => { //get the tracks and save as an option 
    options += `<option value="${track}">${track}</option>`;
    });
  
    
    response.render("songs", { songs: options }); //render with the 
});
/* Initializes request.body with post information */ 
app.use(bodyParser.urlencoded({extended:false}));

app.post("/chooseSongs", async (req, res) => {
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
  const { name, genre, songsSelected} = req.body;

  try {
      await client.connect();

      const playlist = { name, genre, songsSelected };
      const result = await client.db(databaseAndCollection.db)
          .collection(databaseAndCollection.collection)
          .insertOne(playlist);
      res.render("songConfirmation", { name, genre, songs: songsSelected });
  } catch (e) {
      console.error(e);
      res.status(500).send("Error processing application.");
  } finally {
      await client.close();
  }
});

app.get("/viewPlaylist", async (request, response) => { 
    response.render("findPlaylist");
});

app.post("/showingPlaylist", async (request, response) => { 
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
    const obj = {name : request.body.name, genre: request.body.genre};
    let filter = {};
    if(obj.name){
        filter.name = obj.name;
    } else {
        filter.genre = obj.genre; /* will get the first playlist with this genre */
    }
    const cursor = client.db(databaseAndCollection.db).collection(databaseAndCollection.collection).find(filter);
    const result =  await cursor.toArray();
    // console.log(result);
    const ans = {
        showPlaylist : ""
    };

if(result.length == 0){
  ans.showPlaylist += `Playlist not found. Please enter valid playlist name or genre`;
} else {
    ans.showPlaylist += `<strong>Playlist Name :<strong> ${result[0].name} <br> <strong>Genre :<strong> ${result[0].genre} 
    <br> <strong>Albums :<strong> <ol>`;
    result[0].songsSelected.forEach(f => {
   ans.showPlaylist += `<li>${f}</li>`;
    }
    );
    ans.showPlaylist += `</ol>`;
}
response.render("foundPlaylist", ans);

});


app.listen(portNumber, () => {
    console.log(`Server running on http://localhost:${portNumber}`);
});

// Command line stuff starts here
process.stdin.setEncoding("utf8");
const prompt = "Type stop to shutdown the server: ";
process.stdout.write(prompt);

process.stdin.on("readable", function() {
  const dataInput = process.stdin.read();
  if (dataInput !== null) {
    const command = dataInput.trim();

    if (command === "stop") {
        console.log("Shutting down the server");
        process.exit(0);
    } else {
      console.log(`Invalid command: ${command}`);
    }
    process.stdout.write(prompt);
    process.stdin.resume();
  }
});
