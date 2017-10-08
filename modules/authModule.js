const assureSignedIn = (user, socket) => {
  const res = user.signedIn;
  if(res) {
    return true;
  }
  else {
    console.log('An anonymous user tried to access a route');
    return false;
  }
}

module.exports = {
  assureSignedIn: assureSignedIn
}
