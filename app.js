const express = require('express')
const app = express()
const {open} = require('sqlite')
const path = require('path')
const dbPath = path.join(__dirname, './covid19IndiaPortal.db')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
let db = null

app.use(express.json())

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server is running')
    })
  } catch (e) {
    console.log(`DB error : ${e.message}`)
    process.exit(1)
  }
}

initializeDbAndServer()

const convertStateDbObjectToResponseObject = dbObject => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  }
}

const convertDistrictDbObjectToResponseObject = dbObject => {
  return {
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  }
}

const authenticateToken = (request, response, next) => {
  let jwtToken
  const getHeader = request.headers['authentication']

  if (getHeader !== undefined) {
    jwtToken = getHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const selectedUser = `SELECT * FROM user WHERE username = '${username}';`
  const dbUser = await db.get(selectedUser)
  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const passwordCoreection = await bcrypt.compare(password, dbUser.password)
    if (passwordCoreection === true) {
      let payload = {username: username,};
      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

app.get('/states/', authenticateToken, async (reuest, response) => {
  const statesQuery = `SELECT * FROM state`;
  const listOfStates = await db.all(statesQuery)
  response.send(
    listOfStates.map((eachstate =>
      convertStateDbObjectToResponseObject(eachstate)),
    ),
  )
})

app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const stateQuery = `SELECT * FROM state WHERE state_id = ${stateId};`
  const stateData = await db.get(stateQuery)
  response.send(convertStateDbObjectToResponseObject(stateData))
})

app.post('/districts/', authenticateToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const postQuery = `INSERT INTO district(district_name, state_id, cases, cured, active, deaths) VALUES 
                    (${stateId}, '${districtName}', ${cases}, ${cured}, ${active}, ${deaths});`

  await db.run(postQuery)
  response.send('District Successfully Added')
})

//api5

app.get(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const selectDistrictQuery = `SELECT * FROM district WHERE district_id = ${districtId};`
    const districtDetails = await db.get(selectDistrictQuery)
    response.send(convertDistrictDbObjectToResponseObject(districtDetails))
  },
)

//api6

app.delete(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const deleteQuery = `DELETE  FROM district WHERE district_id = ${districtId};`
    await db.run(deleteQuery)
    response.send('District Removed')
  },
)

//api7

app.put(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const updateQuery = `UPDATE district SET
                        district_name = '${districtName}',
                        state_id = ${stateId},
                        cases = ${cases},
                        cured = ${cured},
                        active = ${active}, 
                        deaths = ${deaths}
                      WHERE district_id = ${districtId};`
    await db.run(updateQuery)
    response.send('District Details Updated')
  },
)

//api8

app.get(
  '/states/:stateId/stats/',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params
    const stateQuery = `SELECT
      SUM(cases),
      SUM(cured),
      SUM(active),
      SUM(deaths)
    FROM
      district
    WHERE
      state_id=${stateId};`
    const stats = await database.get(stateQuery)
    response.send({
      totalCases: stats['SUM(cases)'],
      totalCured: stats['SUM(cured)'],
      totalActive: stats['SUM(active)'],
      totalDeaths: stats['SUM(deaths)'],
    })
  },
)

module.exports = app;

