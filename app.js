const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const app = express();

app.use(express.json());

let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log(
        "server started and listening to the port:http://localhost:3000"
      );
    });
  } catch (error) {
    console.log(`db error ${error.message}`);
    process.exit(1);
  }
};
initializeDbAndServer();

function authorizationToken(request, response, next) {
  const authHeaders = request.headers["authorization"];
  let jwtToken;

  if (authHeaders !== undefined) {
    jwtToken = authHeaders.split(" ")[1];

    if (jwtToken === undefined) {
      response.status(401);
      response.send("Invalid JWT Token");
    } else {
      jwt.verify(jwtToken, "My_Secret", (error, user) => {
        if (error) {
          response.status(401);
          response.send("Invalid JWT Token");
        } else {
          next();
        }
      });
    }
  } else {
    response.status(401);
    response.send("Invalid JWT Token");
  }
}

const convertToDbObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
  console.log(dbObject.state_id);
};

const convertToDistrictDbObject = (dbObject) => {
  console.log(dbObject);
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  console.log(request.body);
  const getUserQuery = `
    select * from user where username='${username}';
    `;
  const getUser = await db.get(getUserQuery);

  if (getUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPassword = await bcrypt.compare(password, getUser.password);

    if (isPassword === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "My_Secret");

      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

app.get("/states/", authorizationToken, async (request, response) => {
  const getAllStatesQuery = `
    select * from state`;

  const dbResponse = await db.all(getAllStatesQuery);

  response.send(dbResponse.map((each) => convertToDbObject(each)));
});

//specific state

app.get("/states/:stateId/", authorizationToken, async (request, response) => {
  const { stateId } = request.params;

  const getSpecificState = `
    
    select * from state where state_id=${stateId}`;

  const getState = await db.get(getSpecificState);

  response.send(convertToDbObject(getState));
});

//insert api

app.post("/districts/", authorizationToken, async (request, response) => {
  const { stateId, districtName, cases, cured, active, deaths } = request.body;
  const postDistrictQuery = `
  INSERT INTO
    district (state_id, district_name, cases, cured, active, deaths)
  VALUES
    (${stateId}, '${districtName}', ${cases}, ${cured}, ${active}, ${deaths});`;
  await db.run(postDistrictQuery);
  response.send("District Successfully Added");
});

//
app.get(
  "/districts/:districtId/",
  authorizationToken,
  async (request, response) => {
    const { districtId } = request.params;

    const getDistrictQuery = `
    select * from district where district_id=${districtId}
    `;
    const getDistrictResponse = await db.get(getDistrictQuery);

    response.send(convertToDistrictDbObject(getDistrictResponse));
  }
);

//

app.delete(
  "/districts/:districtId/",
  authorizationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteQuery = `delete from district where district_id=${districtId}`;
    const dbDeleteResponse = await db.run(deleteQuery);
    response.send("District Removed");
  }
);
//
app.put(
  "/districts/:districtId/",
  authorizationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `
  UPDATE
    district
  SET
    district_name = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active}, 
    deaths = ${deaths}
  WHERE
    district_id = ${districtId};
  `;

    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

app.get(
  "/states/:stateId/stats/",
  authorizationToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateStatsQuery = `
    SELECT
      SUM(cases),
      SUM(cured),
      SUM(active),
      SUM(deaths)
    FROM
      district
    WHERE
      state_id=${stateId};`;
    const stats = await db.get(getStateStatsQuery);
    console.log(stats);
    response.send({
      totalCases: stats["SUM(cases)"],
      totalCured: stats["SUM(cured)"],
      totalActive: stats["SUM(active)"],
      totalDeaths: stats["SUM(deaths)"],
    });
  }
);

module.exports = app;
