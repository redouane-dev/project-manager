const { GraphQLScalarType } = require('graphql')
const moment = require('moment')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const nodeMailer = require('nodemailer')

const { User, Team } = require('./models')
const { welcomeEmail } = require('./emails')
const JWT_SECRET = process.env.JWT_SECRET


function randomChoice(arr) {
    return arr[Math.floor(arr.length * Math.random())]
}

const avatarColors = [
    "D81B60", "F06292", "F48FB1", "FFB74D", "FF9800", "F57C00", "00897B", "4DB6AC", "80CBC4",
    "80DEEA", "4DD0E1", "00ACC1", "9FA8DA", "7986CB", "3949AB", "8E24AA", "BA68C8", "CE93D8"
]


const transporter = nodeMailer.createTransport({
    host: 'smtp.gmail.com',
    port: 456,
    secure: true,
    auth: {
        user: process.env.FROM_EMAIL,
        pass: process.env.GMAIL_PASSWORD
    }
})


const resolvers = {
    Query: {
        test (_, args, context) {
            return 'Hello World!';
        }
    },

    Mutation: {
        async captureEmail(_, {email}) {
            const isEmailTaken = await User.findOne({email})
            if (isEmailTaken) {
                // TODO:
                // Change this to something like 'Confirmation already sent to this email'
                // Because this is a security issue since it informs that a user already
                // has this email, so an attacker could focus a phishing attack on him
                throw new Error('This email is already taken !')
            }
            const user = await User.create({
                email,
                role: 'Owner',
                status: 'Pending'
            });

            transporter.sendMail(welcomeEmail(email, user))

            return user;
        },

        async signup (_, {id, firstname, lastname, password}) {
            const user = await User.findById(id)
            const common = {
                firstname,
                lastname,
                name: `${firstname} ${lastname}`,
                avatarColors: randomChoice(avatarColors),
                password: await bcrypt.hash(password, 10),
                status: 'Active'
            }

            if (user.role === 'Owner') {
                const team = await Team.create({
                    name: `${common.name}'s Team`
                })
                user.set({
                    ...common,
                    team: team.id,
                    jobTitle: 'CEO/Owner/Founder'
                })
            } else {
                user.set(common)
            }

            await user.save()
            const token = jwt.sign(
                {
                    id: user.id,
                    email: user.email
                },
                JWT_SECRET
            )

            return { token, user }
        },

        async login (_, {email, password}) {
            const user = await User.findOne({ email })
            if (!user) {
                throw new Error('No user with this email')
            }

            const valid = await bcrypt.compare(password, user.password)
            if (!valid) {
                throw new Error('Incorrect password')
            }

            const token = jwt.sign(
                { id: user.id, email },
                JWT_SECRET
            )
            return { token, user }
        }
    },

    Date: new GraphQLScalarType({
        name: 'Date',
        description: 'Date custom scalar type',
        parseLiteral: (ast) => ast,
        parseValue: (value) => moment(value).toDate(),  // Value from the client
        serialize: (value) => value.getTime(), // Value sent to the client
    })
}

module.exports = resolvers