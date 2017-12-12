#!/usr/bin/env node

'use strict';

const express = require('express');
const app = express()
const PORT = process.env.PORT || 8888;

const request = require('request');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
const path = require('path');


// ***** FIREBASE REALTIME CONFIG ***** //
const firebase = require('firebase');
const config = {
    apiKey: process.env.firebaseapikey,
    authDomain: process.env.firebaseauthdomain,
    databaseURL: process.env.firebasedatabaseurl
};
firebase.initializeApp(config);


// ***** SPOTIFY API ***** //
var SpotifyWebApi = require('spotify-web-api-node');
const secret = process.env.secret
const clientId = process.env.clientId
const redirectUri = 'https://mighty-shelf-28254.herokuapp.com/redirecturi';
const scopes = ['playlist-read-private playlist-read-collaborative playlist-modify-public playlist-modify-private user-follow-modify user-follow-read user-library-read user-library-modify user-top-read user-read-playback-state user-modify-playback-state user-read-currently-playing user-read-recently-played'];
const stateKey = 'spotify_auth_state';
const spotifyApi = new SpotifyWebApi({
    redirectUri: redirectUri,
    clientId: clientId
});


// ***** MIDDLEWARE ***** //
app.use(function (req, res, next) {

    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

    if (req.method === 'OPTIONS') {
        return res.send(200);
    } else {
        return next();
    }
});

app.use(cookieParser());


const generateRandomString = (length) => {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};

const makeEmail = (string) => {
    let stringArray = string.split(' ');
    let prettyString = stringArray.join('');
    return `${prettyString}@totsrealemailprovider.com`;
}



app.get('/login', (req, res) => {
    let state = generateRandomString(16);
    res.cookie(stateKey, state);

    // Sends the browser the request string for Spotify Client Auth.
    // The browser should then open this in a new window that will 
    res.send('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: clientId,
            scope: scopes,
            redirect_uri: redirectUri,
            state: state
        }));
});

app.get('/redirecturi', (req, res) => {
    const code = req.query.code;
    const state = req.query.state;
    const storedState = req.cookies ? req.cookies[stateKey] : null;
    res.clearCookie(stateKey);

    const authOptions = {
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
        if (error) {
            res.status(500).send('You messed it up');
        } else {
            spotifyApi.setAccessToken(body['access_token']);
            spotifyApi.setRefreshToken(body['refresh_token']);

            spotifyApi.getMe()
                .then((data) => {
                    console.log(data);
                    console.log("apiToken from GetMe", spotifyApi.getAccessToken());
                    firebase.database().ref('userDetails/').child(data.body.id).update({
                        email: data.body.display_name ? makeEmail(data.body.display_name) : makeEmail(data.body.id),
                        spotifyId: data.body.id,
                        access_token: body['access_token']
                    });
                })
                .catch((crap) => {
                    console.log('crap', crap);
                })

            res.sendFile(path.join(__dirname + '/client/success.html'));
        }
    });
});


app.get('/recentlyPlayed', (req, res) => {
    console.log("apiToken from recentlyPlayed", spotifyApi.getAccessToken());
    request({
        url: 'https://api.spotify.com/v1/me/player/recently-played?limit=50',
        method: 'get',
        headers: {
            "Authorization": `Bearer ${spotifyApi.getAccessToken()}`
        },
    }, function (error, response, body) {
        if (error) {
            res.status(500).send(error); 
        } else {
            res.send(body); 
        }
    });
});

app.get('/playlists', (req, res) => {
    console.log("apiToken from recentlyPlayed", spotifyApi.getAccessToken());
    request({
        url: `https://api.spotify.com/v1/users/${req.user}/playlists?limit=50`,
        method: 'get',
        headers: {
            "Authorization": `Bearer ${spotifyApi.getAccessToken()}`
        },
    }, function (error, response, body) {
        if (error) {
            res.status(500).send(error); 
        } else {
            res.send(body); 
        }
    });
}); 

app.get('/playlistTracks', (req, res) => {
    console.log("req.playlist", req.playlist)
    request({
        url: `${decodeURIComponent(req.playlistUrl)}`,
        method: 'get',
        headers: {
            "Authorization": `Bearer ${spotifyApi.getAccessToken()}`
        },
    }, function (error, response, body) {
        if (error) {
            res.status(500).send(error); 
        } else {
            res.send(body); 
        }
    });
}); 






app.listen(PORT, () => console.log(`Listening on port: ${PORT}`))

