import mongoose, { Schema, Document } from 'mongoose'

export interface IProduct extends Document {
  name: string
  image: string
  price: number
  quantity: number
  createdAt: Date
  updatedAt: Date
}

const ProductSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 100,
    },
    image: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
  },
  { timestamps: true }
)

export default mongoose.models.Product ||
  mongoose.model<IProduct>('Product', ProductSchema)
