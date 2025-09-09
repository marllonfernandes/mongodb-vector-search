const { google } = require("googleapis");

const {
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI,
  REFRESH_TOKEN,
} = process.env;

const oath2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI,
  REFRESH_TOKEN
);

oath2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

const service = google.admin({
  version: "directory_v1",
  auth: oath2Client,
});

let res = {};
let options = {
  customer: "my_customer",
  maxResults: 500,
  orderBy: "email",
  pageToken: "",
  projection: "full",
};

getUsers = async () => {
  const users = [];

  do {
    res = await service.users.list(options);

    let newUsers = res.data.users.map((user) => ({
      name: user.name.fullName,
      email: user.primaryEmail
        ? user.primaryEmail.toLowerCase().trim()
        : user.primaryEmail,
      status: user.suspended ? "Bloqueado" : "Ativo",
      isAdmin: user.isAdmin,
      lastLoginTime: user.lastLoginTime,
      idunico_horacius:
        "customSchemas" in user &&
        "Horacius" in user.customSchemas &&
        "idunico_horacius" in user.customSchemas.Horacius
          ? user.customSchemas.Horacius.idunico_horacius
          : null,
    }));

    users.push(...newUsers);

    if (res.data.nextPageToken) {
      options.pageToken = res.data.nextPageToken;
    }
  } while (res.data.nextPageToken && res.data.users.length > 0);

  return users
};

module.exports = { getUsers };