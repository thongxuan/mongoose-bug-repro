import {getModelForClass, modelOptions, prop} from "@typegoose/typegoose";
import {Types} from "mongoose";
import mongoose from "mongoose";

class User {
  _id!: Types.ObjectId;

  @prop()
  name?: string;
}

@modelOptions({schemaOptions: {writeConcern: {w: 0}}})
class Log {
  @prop({required: true})
  content!: string;

  @prop({required: true})
  user!: Types.ObjectId;
}

const UserModel = getModelForClass(User);

const LogModel = getModelForClass(Log);

export const withTransaction = async (
  fn: (session: mongoose.ClientSession) => Promise<any>,
  existingSession?: mongoose.ClientSession | null,
) => {
  if (existingSession) {
    if (existingSession.inTransaction()) {
      await fn(existingSession);

      return;
    }

    await existingSession.withTransaction(fn);

    return;
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(fn);
  } finally {
    session.endSession();
  }
};

async function removeUser(_id: Types.ObjectId) {
  await withTransaction(async (session) => {
    //-- this should remove user
    await UserModel.deleteOne({_id}, {session});

    //-- this should remove all user logs
    await LogModel.deleteMany(
      {user: _id},
      {session, writeConcern: {w: "majority"}},
    );
  });
}

async function main() {
  const url =
    "mongodb+srv://root:BmlAZUAxRIE7T5oc@test-mongo.4legkyh.mongodb.net/?retryWrites=true&w=majority";

  console.log("db connecting");
  mongoose.set("debug", true);
  
  await mongoose.connect(url);
  console.log("db connected");

  const user = await UserModel.create({});
  await LogModel.create({user: user._id, content: "test log"});

  await removeUser(user._id);
  console.log("user removed");

  mongoose.disconnect();
}

main().catch(console.error);
