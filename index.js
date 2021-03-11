const {storeSession, getSession} = require('./db')
const express = require('express')
const qs = require('qs')
const axios = require('axios')
const crypto = require('crypto')
const cookieParser = require('cookie-parser')

const WEBSITE_URL = process.env.WEBSITE_URL
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI
const SCOPES = process.env.SPOTIFY_SCOPES
const PORT = process.env.PORT || 4000

const app = express()

app.use(cookieParser())
app.use(express.urlencoded({extended: true}))

app.get('/login', function (req, res) {
    const state = crypto.randomBytes(8).toString('hex');
    res.cookie('auth_state', state, {
        //httpOnly: true,
        sameSite: 'None',
        secure: true
    })

    res.redirect('https://accounts.spotify.com/authorize?' + qs.stringify({
        response_type: 'code',
        state: state,
        client_id: CLIENT_ID,
        scope: SCOPES,
        redirect_uri: REDIRECT_URI
    }));
});

app.get('/callback', function (req, res) {
    if (!('auth_state' in req.cookies) || req.query.state !== req.cookies['auth_state'])
        return res.redirect('https://trndsettr.com/playlist' + '#state-error')

    if (req.query.error)
        return res.redirect('https://trndsettr.com/playlist' + '#' + req.params.error)

    const code = req.query.code
    if (!code) return res.sendStatus(400)

    axios.post('https://accounts.spotify.com/api/token', qs.stringify({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET
    }), {
        headers: {'Content-Type': 'application/x-www-form-urlencoded'}
    })
        .then(async (result) => {
            res.clearCookie('auth_state')

            if (result.status !== 200) {
                res.redirect('https://trndsettr.com/playlist' + '#server-error1')
                console.log('pass first server err')
                return
            }

            const {access_token, expires_in, refresh_token} = result.data
            console.log(result.data)
            const userResp = await axios.get("https://api.spotify.com/v1/me", {
                headers: {'Authorization': 'Bearer ' + access_token}
            })

            if (userResp.status !== 200) {
                res.redirect('https://trndsettr.com/playlist' + '#server-error2')
                return
            }

            const {email, id} = userResp.data;
            console.log(userResp.data)
            const session_id = crypto.randomBytes(16).toString('hex')
            await storeSession(session_id, email, id, access_token, expires_in, refresh_token)
console.log()
            res.cookie('session_id', session_id, {httpOnly: true, sameSite: 'None'})
            res.redirect('https://trndsettr.com/playlist' + '#ok')
        })
        .catch((err) => {
            console.log(err)
            res.redirect('https://trndsettr.com/playlist' + '#server-error3')
        })
})

app.post('/', (req, res) => {
    if (!('session_id' in req.cookies))
        return res.sendStatus(400)

    const session_id = req.cookies['session_id']
    getSession(session_id)
        .then(async (session) => {
            if (!session) return res.sendStatus(401)

            let access_token = session.access_token
            if (session.expires <= new Date().getTime() / 1000 - 60 * 5 /* Refresh token up to 5 minutes before expiration */) {
                const result = await axios.post('https://accounts.spotify.com/api/token', qs.stringify({
                    grant_type: 'refresh_token',
                    refresh_token: session.refresh_token,
                    client_id: CLIENT_ID,
                    client_secret: CLIENT_SECRET
                }), {
                    headers: {'Content-Type': 'application/x-www-form-urlencoded'}
                })

                if (result.status !== 200)
                    return res.sendStatus(500)

                const {new_access_token, new_expires_in, new_refresh_token} = result.data
                await storeSession(session_id, new_access_token, new_expires_in, new_refresh_token || session.refresh_token)

                access_token = new_access_token
            }

            const method = req.body.method
            const endpoint = req.body.endpoint // Use relative path to prevent someone from spoofing the token

            axios('https://api.spotify.com/' + endpoint, {
                method: method,
                headers: {'Authorization': 'Bearer ' + access_token}
            })
                .then((result) => {
                    res.header('Content-Type', result.headers['content-type'])
                        .status(200)
                        .send(result.data)
                })
                .catch((err) => {
                    console.log(err)
                    res.status(500)
                        .send((err.response && err.response.data) || '')
                })
        })
        .catch((err) => {
            console.log(err)
            res.sendStatus(500)
        })
})

app.post('/me', (req, res) => {
    if (!('session_id' in req.cookies))
        return res.sendStatus(400)

    const session_id = req.cookies['session_id']
    getSession(session_id)
        .then((session) => {
            if (!session) return res.sendStatus(401)

            res.header('Content-Type', 'application/json')
            res.status(200)
            res.send({'email': session.email, 'userId': session.userId})
        })
        .catch((err) => {
            console.log(err)
            res.sendStatus(500)
        })
});


app.listen(PORT)
