import React from 'react'
import {createRoot} from 'react-dom/client'
import {QueryClientProvider} from '@tanstack/react-query'
import './index.css'
import App from './App'
import {queryClient} from '@/lib/query-client'

const container = document.getElementById('root')

const root = createRoot(container!)

root.render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <App/>
        </QueryClientProvider>
    </React.StrictMode>
)
