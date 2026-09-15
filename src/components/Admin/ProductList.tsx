'use client'

import { useState } from 'react'

interface Product {
  _id: string
  name: string
  image: string
  price: number
  quantity: number
}

export default function ProductList({
  products,
  onProductUpdated,
}: {
  products: Product[]
  onProductUpdated: () => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selected)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelected(newSelected)
  }

  const toggleSelectAll = () => {
    if (selected.size === products.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(products.map((p) => p._id)))
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return

    try {
      const response = await fetch(`/api/admin/products/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
        },
      })

      if (response.ok) {
        onProductUpdated()
        setSelected(new Set())
      }
    } catch (error) {
      console.error('Error deleting product:', error)
    }
  }

  return (
    <div className="space-y-4">
      {selected.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <span className="text-blue-900 font-semibold">
            {selected.size} product{selected.size !== 1 ? 's' : ''} selected
          </span>
          <div className="space-x-2">
            <button
              onClick={() => setSelected(new Set())}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition text-sm font-semibold"
            >
              Clear Selection
            </button>
            <button className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition text-sm font-semibold">
              ✓ Publish Selected to Gallery
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th className="px-6 py-4 text-left">
                <input
                  type="checkbox"
                  checked={selected.size === products.length && products.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 cursor-pointer"
                />
              </th>
              <th className="px-6 py-4 text-left font-semibold text-gray-700">
                Image
              </th>
              <th className="px-6 py-4 text-left font-semibold text-gray-700">
                Name
              </th>
              <th className="px-6 py-4 text-left font-semibold text-gray-700">
                Price
              </th>
              <th className="px-6 py-4 text-left font-semibold text-gray-700">
                Quantity
              </th>
              <th className="px-6 py-4 text-left font-semibold text-gray-700">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product._id} className={`border-b hover:bg-gray-50 transition ${
                selected.has(product._id) ? 'bg-blue-50' : ''
              }`}>
                <td className="px-6 py-4">
                  <input
                    type="checkbox"
                    checked={selected.has(product._id)}
                    onChange={() => toggleSelect(product._id)}
                    className="w-4 h-4 cursor-pointer"
                  />
                </td>
                <td className="px-6 py-4">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-12 h-12 object-cover rounded"
                  />
                </td>
                <td className="px-6 py-4 font-semibold">{product.name}</td>
                <td className="px-6 py-4">₹{product.price.toLocaleString()}</td>
                <td className="px-6 py-4">{product.quantity}</td>
                <td className="px-6 py-4 space-x-2">
                  <button className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition text-sm">
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(product._id)}
                    className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition text-sm"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {products.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No products found</p>
          </div>
        )}
      </div>
    </div>
  )
}
