import React from 'react'
import { Box, Card, CardContent, Typography } from '@mui/material'

export const UniqueBlock: React.FC = () => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Уникализированные видео</Typography>
        <Box>
          <Typography color="text.secondary">Пока недоступно. При попытке отправки на уникализацию сервер вернёт 501 Not Implemented.</Typography>
        </Box>
      </CardContent>
    </Card>
  )
}

