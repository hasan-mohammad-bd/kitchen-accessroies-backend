const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
var jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

//middleware 
app.use(cors());
app.use(express.json())


function verifyJWT(req, res, next){
    const authHeader = req.headers.authorization;
    if(!authHeader){
        return res.status(401).send({message: 'UnAuthorized Access'})
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function(err, decoded){
        if(err){
            return res.status(403).send({message: 'Forbidden'})
        }
        req.decoded = decoded;
        next();
    })
}




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vpxj7.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
console.log('mongodb connected');

const run = async () => {
    try{
        await client.connect();
        const productCollection = client.db('tools-shop').collection('product');
        const userCollection = client.db('tools-shop').collection('user');
        const reviewCollection = client.db('tools-shop').collection('review');
        const bookCollection = client.db('tools-shop').collection('book');
        const paymentCollection = client.db('tools-shop').collection('payments');
        const projectCollection = client.db('tools-shop').collection('project');

        const verifyAdmin = async (req, res, next) =>{
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({email: requester});
            if(requesterAccount.role === 'admin'){
              next()
            }
            else{
              res.status(403).send({message: 'forbidden'})
            }
          }


        
          app.post('/create-payment-intent', verifyJWT, async(req, res) =>{
            const service = req.body;
            console.log(service);
            const price = service.totalPrice;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
              amount : amount,
              currency: 'usd',
              payment_method_types:['card']
            });
            res.send({clientSecret: paymentIntent.client_secret})
          });


        //product Database

        app.post('/product',verifyJWT,verifyAdmin, async (req, res)=>{
            const product = req.body;
            const result = await productCollection.insertOne(product);
            res.send(result)
        })
        app.get('/product/:id',verifyJWT, async (req, res)=>{
            const id = req.params.id
            const filter = {_id : ObjectId(id)}
            const product = await productCollection.findOne(filter);
            res.send(product)
        })

        //portfolio api
        app.get('/project/:id', async (req, res)=>{
            const id = req.params.id
            const filter = {_id : ObjectId(id)}
            const project = await projectCollection.findOne(filter);
            res.send(project)
        })

        app.get('/product', async (req, res)=> {
            const product= await productCollection.find().toArray();
            res.send(product);
        })

        //portfolio api
        app.get('/project', async (req, res)=> {
            const product= await projectCollection.find().toArray();
            res.send(product);
        })

        app.delete('/product/:id',verifyJWT, async (req, res) => {
            const id = req.params.id
            const filter = {_id : ObjectId(id)}
            const result = await productCollection.deleteOne(filter)
            res.send(result);
        })

        app.put('/productQuantity/:id',verifyJWT, async(req, res) =>{
            const id = req.params.id
            const filter = {_id: ObjectId(id)};
            const updateDoc = {
              $set: req.body
            };
            const result = await productCollection.updateOne(filter, updateDoc);
            res.send(result)
          
        })

        //user Database

        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = {email: email}
            const options = {upsert: true};
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options)
            const token = jwt.sign({email: email}, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '3h'});
            res.send({result, token});
        })
        app.put('/profile/:email',verifyJWT, async (req, res) => {
            const email = req.params.email;
            const profile = req.body;
            const filter = {email: email}
            const options = {upsert: true};
            const updateDoc = {
                $set: profile,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options)
            res.send(result);
        })

        app.get('/user',verifyJWT,verifyAdmin, async(req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users);
        })

        app.get('/user/:email',verifyJWT, async(req, res) => {
            const email = req.params.email;
            const filter = {email : email}
            const user = await userCollection.findOne(filter);
            res.send(user);
        })

        app.put('/user/admin/:email' ,verifyJWT,verifyAdmin, async(req, res) =>{
            const email = req.params.email;
            const filter = {email: email};
            const updateDoc = {
              $set: {role: 'admin'}
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result)
          
        })
        app.put('/user/adminRemove/:email', verifyJWT,verifyAdmin, async(req, res) =>{
            const email = req.params.email;
            const filter = {email: email};
            const updateDoc = {
              $set: {role: 'null'}
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result)
          
        })

        app.get('/admin/:email', async(req, res)=>{
            const email = req.params.email;
            const user = await userCollection.findOne({email: email});
            const isAdmin = user.role === 'admin';
            res.send({admin: isAdmin})
          })


          //review

          app.post('/review',verifyJWT, async (req, res)=>{
            const product = req.body;
            const result = await reviewCollection.insertOne(product);
            res.send(result)
        })

        app.get('/review', async (req, res)=> {
            const review= await reviewCollection.find().toArray();
            res.send(review);
        })

        //booking
        
        app.post('/book',verifyJWT, async (req, res)=>{
            const book = req.body;
            const result = await bookCollection.insertOne(book);
            res.send(result)
        })

        app.get('/book/:email',verifyJWT, async (req, res)=> {
            const email = req.params.email;
            const filter = {email : email}
            const booking= await bookCollection.find(filter).toArray();
            res.send(booking);
        })

        app.delete('/book/:id',verifyJWT,verifyAdmin, async (req, res) => {
            const id = req.params.id
            const filter = {_id : ObjectId(id)}
            const result = await bookCollection.deleteOne(filter)
            res.send(result);
        })
        app.get('/book',verifyJWT,verifyAdmin, async (req, res) => {
            const books = await bookCollection.find().toArray()
            res.send(books);
        })

        app.get('/booking/:id',verifyJWT, async(req, res) =>{
            const id = req.params.id;
            const query = {_id : ObjectId(id)};
            const booking = await bookCollection.findOne(query);
            res.send(booking);
        })


        app.patch('/booking/:id', verifyJWT, async(req, res) =>{
            const id  = req.params.id;
            const payment = req.body;
            const filter = {_id: ObjectId(id)};
            const updatedDoc = {
              $set: {
                paid: true,
                transactionId: payment.transactionId
              }
            }
      
            const result = await paymentCollection.insertOne(payment);
            const updatedBooking = await bookCollection.updateOne(filter, updatedDoc);
            res.send(updatedBooking);
          })

          app.patch('/status/:id' ,verifyJWT,verifyAdmin, async(req, res) =>{
            const update = req.body;
            const id = req.params.id;
            console.log(id);
            const filter = {_id : ObjectId(id)};
            const updateDoc = {
              $set: update
            };
            const result = await bookCollection.updateOne(filter, updateDoc);
            res.send(result)
        })




    }
    finally{

    }

}

run().catch(console.dir);





app.get('/', (req, res)=>{
    res.send('running the manufacturer-app');
})

app.listen(port, ()=> {
    console.log('the server is running');
})