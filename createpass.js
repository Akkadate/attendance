const bcrypt = require('bcrypt');
const password = 'Tct85329$';
bcrypt.hash(password, 10, function(err, hash) {
    console.log(hash);
});
