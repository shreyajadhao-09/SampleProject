const express = require("express");
const app = express();
const mongoose = require("mongoose");
const Listing = require("./models/listing.js");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const wrapAsync = require("./utils/wrapAsync.js");
const ExpressError = require("./utils/ExpressError.js");
const { listingSchema, reviewSchema } = require("./schema.js");
const Review = require("./models/review.js");

const PORT = process.env.PORT || 8080;
const DB_URL = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/wanderlust";

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(methodOverride("_method"));
app.use(express.urlencoded({ extended: true }));
app.engine("ejs", ejsMate);
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.send("Working");
});
// app.get("/testListning", async (req, res)=>{
//   let sampleListing = new Listing({
//     title:"My New Villa",
//     description: "By the beach",
//     price:1200,
//     location: "Calangute, Goa",
//     country: "India",
//   });
//   await sampleListing.save();
//   console.log("Sample was created");
//   res.send("Succesful testing");
// });

async function connectDB() {
  await mongoose.connect(DB_URL, { serverSelectionTimeoutMS: 5000 });
}

async function startServer() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`app is listening on port ${PORT}`);
  });
}

function handleNotFound(doc, message = "Resource not found") {
  if (!doc) {
    throw new ExpressError(404, message);
  }
  return doc;
}

function normalizeError(err) {
  if (err instanceof ExpressError) {
    return err;
  }

  if (err.name === "CastError") {
    return new ExpressError(400, "Invalid ID format");
  }

  if (err.name === "ValidationError") {
    const message = Object.values(err.errors)
      .map((error) => error.message)
      .join(", ");
    return new ExpressError(400, message || "Invalid request data");
  }

  return err;
}

const validateListing = (req, res, next) => {
  let { error } = listingSchema.validate(req.body, { abortEarly: false });
  if (error) {
    let errMsg = error.details.map((el) => el.message).join(", ");
    throw new ExpressError(400, errMsg);
  } else {
    next();
  }
};

const validateReview = (req, res, next) => {
  let { error } = reviewSchema.validate(req.body || {}, { abortEarly: false });
  if (error) {
    let errMsg = error.details.map((el) => el.message).join(", ");
    throw new ExpressError(400, errMsg);
  } else {
    next();
  }
};

//Index route
app.get(
  "/listings",
  wrapAsync(async (req, res) => {
    let allListings = await Listing.find({});
    res.render("listings/index", { allListings });
  }),
);

//new route
app.get("/listings/new", (req, res) => {
  res.render("listings/new.ejs");
});

//show route
app.get(
  "/listings/:id",
  wrapAsync(async (req, res) => {
    let { id } = req.params;
    let listing = await Listing.findById(id).populate("reviews");
    handleNotFound(listing, "Listing not found");
    res.render("listings/show.ejs", { listing });
  }),
);

//Create Route
app.post(
  "/listings",
  validateListing,
  wrapAsync(async (req, res, next) => {
    const newListing = new Listing(req.body.listing);
    await newListing.save();
    res.redirect("/listings");
  }),
);

//Edit Route
app.get(
  "/listings/:id/edit",
  wrapAsync(async (req, res) => {
    let { id } = req.params;
    let listing = await Listing.findById(id);
    handleNotFound(listing, "Listing not found");
    res.render("listings/edit.ejs", { listing });
  }),
);

//Update Route
app.put(
  "/listings/:id",
  validateListing,
  wrapAsync(async (req, res) => {
    let { id } = req.params;
    let listing = await Listing.findByIdAndUpdate(id, { ...req.body.listing }, { runValidators: true });
    handleNotFound(listing, "Listing not found");
    res.redirect(`/listings/${id}`);
  }),
);

//Delete Route
app.delete(
  "/listings/:id",
  wrapAsync(async (req, res) => {
    let { id } = req.params;
    let deletedListing = await Listing.findByIdAndDelete(id);
    handleNotFound(deletedListing, "Listing not found");
    await Review.deleteMany({ _id: { $in: deletedListing.reviews } });
    res.redirect("/listings");
  }),
);

//Reviews
//Post Route
app.post(
  "/listings/:id/reviews",
  validateReview,
  wrapAsync(async (req, res) => {
    let listing = await Listing.findById(req.params.id);
    handleNotFound(listing, "Listing not found");
    let newReview = new Review(req.body.review);

    listing.reviews.push(newReview);
    await newReview.save();
    await listing.save();
    res.redirect(`/listings/${listing._id}`);
  }),
);


app.all("/{*splat}", (req, res, next) => {
  next(new ExpressError(404, "Page Not Found!"));
});

//Middelware: errorHandling
app.use((err, req, res, next) => {
  err = normalizeError(err);
  let { statusCode = 500, message = "Something Went Wrong!" } = err;
  statusCode = Number.isInteger(statusCode) && statusCode >= 400 ? statusCode : 500;
  err.statusCode = statusCode;
  err.message = message || "Something Went Wrong!";
  // res.status(statusCode).send(message);
  res.status(statusCode).render("error.ejs", { err });
});

if (require.main === module) {
  startServer()
    .then(() => {
      console.log("database connected successfully");
    })
    .catch((err) => {
      console.error("Failed to start server:", err.message);
      process.exit(1);
    });
}

module.exports = app;
