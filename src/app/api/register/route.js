import mongoDbService from "../../../../services/mongoDbService";
import { hash } from "bcrypt";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { username, email, password } = await req.json();

    if (!username || !email || !password) {
      return NextResponse.json({ message: "Missing fields" }, { status: 400 });
    }

    const { db } = await mongoDbService.connect("main-data", "users");

    const existingUser = await db
      .collection("users")
      .findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return NextResponse.json(
        { message: "User already exists" },
        { status: 409 }
      );
    }

    const hashedPassword = await hash(password, 12);

    const result = await db.collection("users").insertOne({
      username,
      email,
      password: hashedPassword,
    });

    return NextResponse.json(
      { message: "User created", userId: result.insertedId },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
