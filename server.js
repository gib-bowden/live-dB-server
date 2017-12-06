#!/usr/bin/env node
'use strict';

const express = require('express');
const app = express()
const PORT = process.env.PORT || 8888;
const request = require('request');

var SpotifyWebApi = require('spotify-web-api-node');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');

const secret = process.env.secret;
const clientId = process.env.clientId;
const redirectUri = `https://mighty-shelf-28254.herokuapp.com/redirecturi`;//`http://localhost:8080/#!/home/` 
const scopes = ['user-read-private user-read-email playlist-read-private playlist-read-collaborative playlist-modify-public playlist-modify-private user-follow-modify user-follow-read user-library-read user-library-modify user-top-read user-read-playback-state user-modify-playback-state user-read-currently-playing user-read-recently-played'];
let state;


app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.use(cookieParser());


var spotifyApi = new SpotifyWebApi({
    redirectUri : redirectUri,
    clientId : clientId
});

var generateRandomString = function(length) {
    var text = '';
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  
    for (var i = 0; i < length; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};
  
var stateKey = 'spotify_auth_state';
    
  
  app.get('/login', function(req, res) {
  
    var state = generateRandomString(16);
    res.cookie(stateKey, state);
  
    // your application requests authorization
    res.redirect('https://accounts.spotify.com/authorize?' +
      querystring.stringify({
        response_type: 'code',
        client_id: clientId,
        scope: scopes,
        redirect_uri: redirectUri,
        state: state
      }))
      
  });

app.get('/redirecturi', (req, res) => {
    const code = req.query.code;
    const state = req.query.state;
    var storedState = req.cookies ? req.cookies[stateKey] : null;


    res.clearCookie(stateKey);
    var authOptions = {
        url: 'https://accounts.spotify.com/api/token',
        form: {
        code: code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
        },
        headers: {
        'Authorization': 'Basic ' + (new Buffer(clientId + ':' + secret).toString('base64'))
        },
        json: true
    };

    request.post(authOptions, (error, response, body) => {
        if (error) {res.status(500).send('You messed it up');}
        else {
            spotifyApi.setAccessToken(body['access_token']);
            spotifyApi.setRefreshToken(body['refresh_token']);
            res.status(200).send(body['access_token']);
        }
    })
});

app.get('/userPlaylist', (req, res) => {
    spotifyApi.getMe()
    .then(function(data) {
      spotifyApi.getUserPlaylists(data.body.id)
      .then(function(data) {
        res.json(data.body.items);
      },function(err) {
        res.status(400).send(err);
      });
    }, function(err) {
        res.status(400).send(err);
    });
});



app.listen(PORT, () => console.log(`Listening on port: ${PORT}`))