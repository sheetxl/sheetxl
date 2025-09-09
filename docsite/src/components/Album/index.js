import * as React from 'react';

import { Card } from '@mui/material';
import { CardContent } from '@mui/material';
import { CardMedia } from '@mui/material';
import { Grid2 } from '@mui/material';
import { Typography } from '@mui/material';
import { Container } from '@mui/material';
import { CardActionArea } from '@mui/material';
// import { CardActions } from '@mui/material';
import { Box } from '@mui/material';
import { IconButton } from '@mui/material';

import { GitHub as GitHubIcon } from '@mui/icons-material';

const DefaultSVG = require('@site/static/img/undraw_spreadsheet_1.svg').default;
const MEDIA_PROPS = {
  padding: `4px 8px`,
  backgroundSize: 'initial',
  objectFit: 'contain',
  width:  'unset',
  maxWidth: '100%',
  height: '200px',
  margin: '0 auto'
};

export default function Album({cards}) {
  return (
    <Container sx={{ py: 8, pt: 4 }} maxWidth="md">
      {/* End hero unit */}
      <Grid2 container spacing={4} justifyContent="center">
        {cards.map((card, index) => (
          <Grid2 item key={index} size={{ xs: 12, sm: 6, md: 4 }} >
            <Card elevation={4}
              sx={{ height: '100%', flexDirection: 'column' }}
            >
              <CardActionArea
                href={card.url}
                target="_blank"
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  flex: '1 1 100%'
                }}
              >
                { card.src ? <CardMedia component="img" sx={MEDIA_PROPS} alt={`${card.title} Demo`} image={card.src}/> : <DefaultSVG role="img"style={MEDIA_PROPS}/> }
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'row',
                    }}
                  >
                    <Typography gutterBottom variant="h5">
                      {card.title}
                    </Typography>
                    <Box sx={{ flexGrow: 1 }} />
                    { card.gitSource ? <IconButton
                      sx={{
                        padding: '0px',
                        width: '24px',
                        minWidth: '0px',
                        height: '24px',
                        borderRadius: '50%',
                      }}
                      aria-label="Source"
                      component="div"
                      href={card.gitSource}
                      onClick={(e) => {
                        window.open(card.gitSource, "_blank");
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                    >
                      <GitHubIcon />
                    </IconButton>
                    : null }
                  </Box>
                  <Typography color="text.secondary">
                    {card.description}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid2>
        ))}
      </Grid2>
    </Container>
  );
}