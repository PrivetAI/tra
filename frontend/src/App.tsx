import { Box, Grid, Typography, Snackbar, Alert } from '@mui/material'
import React from 'react'
import { Platform } from './api'
import { PlatformColumn } from './components/PlatformColumn'
import { UniqueBlock } from './components/UniqueBlock'

export default function App() {
  const [error, setError] = React.useState<string|undefined>()
  const onError = (msg: string) => setError(msg)

  const columns: Platform[] = ['youtube','tiktok','instagram']

  return (
    <Box sx={{ py: 3 }}>
      <Grid container spacing={2}>
        {columns.map((p) => (
          <Grid item xs={12} md={4} key={p}>
            <PlatformColumn platform={p} onError={onError} />
          </Grid>
        ))}
      </Grid>
      <Box sx={{ mt: 4 }}>
        <UniqueBlock />
      </Box>
      <Snackbar open={!!error} autoHideDuration={4000} onClose={() => setError(undefined)}>
        <Alert onClose={() => setError(undefined)} severity="error" variant="filled">{error}</Alert>
      </Snackbar>
    </Box>
  )
}

