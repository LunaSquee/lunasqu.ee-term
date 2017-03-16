import bcrypt from 'bcryptjs'

module.exports.hashPassword = async function (password, rounds) {
  const salt = bcrypt.genSaltSync(parseInt(rounds, 10))
  const hash = bcrypt.hashSync(password, salt)

  return hash
}

module.exports.comparePassword = async function (password, hash) {
  const evalu = bcrypt.compareSync(password, hash)

  return evalu
}
