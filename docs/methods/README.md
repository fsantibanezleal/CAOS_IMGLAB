# Methods, the representation families

ImageLab carries one image across seven families of mathematical representation, ordered along the editability
curve. Each family is a tab in the app; each tab's Method sub-tab transcribes the theory below with rendered
equations and references. A representation is a way to write an image as parameters; the question every tab asks
is what a perturbation of those parameters does.

## 1. Orthonormal transforms (live)

Fourier, DCT and wavelets write the image in a fixed orthonormal basis: `x = sum_k c_k phi_k`, with coefficients
`c_k = <x, phi_k>`. The basis is global and complete, so the map is exact and invertible. Editing is exact and
predictable per coefficient, but a single coefficient is spatially spread (a Fourier coefficient is a global
grating; a DCT coefficient is a per-block frequency; a wavelet coefficient is local in both space and scale). The
tabs let you keep the top-k coefficients, zero bands, and quantize (the JPEG path), reading the rate/distortion
tradeoff live. The KLT (PCA) tab replaces the fixed basis with the data-optimal basis learned from image patches,
the orthonormal transform with the best energy compaction for this image statistics.

References: Ahmed, Natarajan and Rao 1974 (DCT); Mallat 1989 (wavelets); Wallace 1992 (JPEG).

## 2. Overcomplete frames + sparse dictionaries (live)

Drop the orthonormal constraint: use a dictionary `D` with more atoms than pixels and represent the image with a
sparse code, `min ||a||_0 s.t. x approx D a`. Orthogonal Matching Pursuit picks atoms greedily. A learned
dictionary (from patches) or an overcomplete DCT gives atoms that match real image structure, so a handful of
atoms reconstruct a patch. Editing is local and semantic per atom, and this is the first pole of high editability:
the atoms are a designed, interpretable structure.

References: Mallat and Zhang 1993 (matching pursuit); Aharon, Elad and Bruckstein 2006 (K-SVD).

## 3. Geometric primitives (live)

Approximate the image with an ordered list of translucent shapes (ellipses), fit greedily to reduce the residual.
Each shape is an independent, meaningful, local coordinate (position, size, orientation, colour, opacity), so this
is the cleanest semantic-local representation: move one ellipse and only that region changes. The tab renders the
first k shapes to show the image build up shape by shape and reads the PSNR of the partial reconstruction.

Reference: the evolutionary-primitives line of work (Johansson's "EvoLisa", 2008, and successors).

## 4. Implicit neural field (offline train, live GPU forward pass)

Fit a small coordinate network (SIREN, a sinusoidal-activation MLP) so that `f_theta(x, y) approx image(x, y)`.
The image becomes the weights `theta`, a continuous, resolution-free representation. Training is offline; the
forward pass runs live on the GPU (a WebGL2 fragment shader evaluates the MLP per pixel). Editing the weights or
the input frequency scales the image globally and smoothly, but the parameters are entangled: no single weight is
a named handle.

References: Sitzmann et al. 2020 (SIREN); Tancik et al. 2020 (Fourier features).

## 5. Symbolic formula art (live)

A Compositional Pattern-Producing Network maps coordinates to colour through a fixed symbolic graph of primitive
functions (sin, gaussian, products). The image is a short symbolic expression, and small changes to its constants
sweep whole families of coherent patterns. This is generative structure from a compact parametric formula, closer
to the design pole than the neural field because the graph is legible.

Reference: Stanley 2007 (CPPNs).

## 6. Fourier descriptors / epicycles (live)

Trace a closed outline as a complex signal and take its DFT: the shape becomes a sum of rotating circles
(epicycles), `z(t) = sum_k c_k e^{i k t}`. Truncating the high-order terms smooths the outline; the coefficients
are an exact, orderable parametric description of the contour. The tab reconstructs the outline from the first k
epicycles.

Reference: the classical Fourier-descriptor shape literature (Zahn and Roskies 1972).

## 7. Learned generative latents (offline bake, live scrub)

An autoencoder or diffusion model maps the image to a low-dimensional latent and back: `z = E(x)`, `x_hat = D(z)`.
The VAE tab interpolates between two images' latents, `z_t = (1 - t) z_a + t z_b`, and decodes each step, so the
blend stays on the learned manifold (a plausible image at every step, not a pixel cross-fade). The diffusion tab
shows the reverse process, an image emerging from noise step by step, and a prompt-interpolation walk. This is the
second pole of high editability: a latent nudge is semantic (it moves along meaningful directions) but entangled
(the whole image changes together). These are baked offline (the models are too heavy for the browser) and
replayed, honestly labelled as generative interpolation rather than a faithful edit of your exact image.

References: Kingma and Welling 2013 (VAE); Karras et al. 2019 (StyleGAN); Harkonen et al. 2020 (GANSpace); Rombach
et al. 2022 (latent diffusion).
